import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bus, Inbox, LoaderCircle, LogOut, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import {
  addDraft, COMMUNITY_BODY_LIMIT, COMMUNITY_CATEGORIES, deleteDraft,
  readDraftStore, updateDraft,
} from '../utils/communityDrafts.js';
import { getRouteEnds, vehicleRouteLabel } from '../utils/routeEnds.js';
import { normalizeDirectorySearch } from '../utils/routeDirectory.js';
import { currentToken, request } from '../community/api.js';
import { getAuthClient, signInWithGoogle } from '../community/auth.js';
import { advanceIfChanged, appendUniqueById, createEpochController } from '../community/asyncState.js';
import { applyModerationDecision } from '../community/moderationState.js';
import './CommunityHub.css';

const CATEGORY_LABELS = {
  ar: { fare: 'الأجرة', detour: 'تحويلة', frequency: 'التردد والمواعيد', tip: 'نصيحة', route: 'تصحيح مسار' },
  en: { fare: 'Fare', detour: 'Detour', frequency: 'Frequency', tip: 'Tip', route: 'Route correction' },
};
const text = (lang, ar, en) => lang === 'ar' ? ar : en;
const routeTitle = (route, lang) => {
  if (!route) return '';
  const { from, to } = getRouteEnds(route, lang);
  const directionLabel = Number.isFinite(Number(route.dir))
    ? (Number(route.dir) === 0 ? text(lang, 'ذهاب', 'Outbound') : text(lang, 'عودة', 'Return')) : '';
  const endpoints = from && to ? `${from} ${lang === 'ar' ? '←' : '→'} ${to}`
    : from ? `${text(lang, 'يبدأ من', 'Starts at')} ${from}`
      : text(lang, 'الاتجاه غير محدد', 'Direction unavailable');
  return `${vehicleRouteLabel(route, lang) || route.num || text(lang, 'مسار', 'Route')} · ${endpoints}${directionLabel ? ` · ${directionLabel}` : ''}`;
};
const matchesSearch = (item, query, route) => {
  const haystack = `${item.body} ${item.category} ${route?.num || ''} ${route?.origin || ''} ${route?.dest || ''} ${route?.origin_en || ''} ${route?.dest_en || ''}`.toLocaleLowerCase();
  return haystack.includes(query.trim().toLocaleLowerCase());
};

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('unavailable');
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.code || 'unavailable');
  return payload;
}

export default function CommunityHub({ routes = [], onSelectRoute, onOpenPlanner, lang = 'ar', variant = 'sidebar' }) {
  const [view, setView] = useState('public');
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [publicPosts, setPublicPosts] = useState([]);
  const [feedState, setFeedState] = useState('loading');
  const [refresh, setRefresh] = useState(0);
  const [draftStore, setDraftStore] = useState(() => readDraftStore());
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [routeQuery, setRouteQuery] = useState('');
  const [routeMenuOpen, setRouteMenuOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [draftCategory, setDraftCategory] = useState('fare');
  const [body, setBody] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formError, setFormError] = useState(false);
  const [draftActionMessage, setDraftActionMessage] = useState('');
  const [draftActionError, setDraftActionError] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [authClient, setAuthClient] = useState(null);
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const [aliasValue, setAliasValue] = useState('');
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [aliasBusy, setAliasBusy] = useState(false);
  const [aliasMessage, setAliasMessage] = useState('');
  const [aliasError, setAliasError] = useState('');
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [ownPosts, setOwnPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [myVotes, setMyVotes] = useState({});
  const [commentCursors, setCommentCursors] = useState({});
  const [ownComments, setOwnComments] = useState([]);
  const [editingOwnCommentId, setEditingOwnCommentId] = useState(null);
  const [ownCommentBody, setOwnCommentBody] = useState('');
  const [commentText, setCommentText] = useState({});
  const [moderationItems, setModerationItems] = useState([]);
  const [moderationStatus, setModerationStatus] = useState('pending');
  const [moderationKind, setModerationKind] = useState('posts');
  const [editingOwnId, setEditingOwnId] = useState(null);
  const [ownEditBody, setOwnEditBody] = useState('');
  const [feedCursor, setFeedCursor] = useState(null);
  const [moderationCursor, setModerationCursor] = useState(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [busyActions, setBusyActions] = useState({});
  const authEpoch = useRef(createEpochController());
  const feedEpoch = useRef(createEpochController());
  const moderationEpoch = useRef(createEpochController());
  const commentEpochs = useRef(new Map());
  const activeUserId = useRef(null);
  const accountSettingsDialog = useRef(null);
  const accountSettingsButton = useRef(null);
  const aliasInput = useRef(null);
  const isArabic = lang === 'ar';
  const statusLabel = status => ({ pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض', hidden: 'مخفي' }[status] || 'الحالة غير معروفة');
  const labels = CATEGORY_LABELS[isArabic ? 'ar' : 'en'];
  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  const authToken = async () => currentToken(authClient);
  const authenticatedRequest = async (path, options = {}) => {
    const snapshot = authSnapshot();
    let token;
    try { token = await authToken(); }
    catch (error) { if (!authSnapshotIsCurrent(snapshot)) { const stale = new Error('stale-session'); stale.stale = true; throw stale; } throw error; }
    if (!authSnapshotIsCurrent(snapshot) || !token) { const error = new Error('stale-session'); error.stale = true; throw error; }
    let payload;
    try { payload = await request(path, { ...options, token }); }
    catch (error) { if (!authSnapshotIsCurrent(snapshot)) { const stale = new Error('stale-session'); stale.stale = true; throw stale; } throw error; }
    if (!authSnapshotIsCurrent(snapshot)) { const error = new Error('stale-session'); error.stale = true; throw error; }
    return payload;
  };
  const authSnapshot = () => ({ epoch: authEpoch.current.capture(), userId: activeUserId.current });
  const authSnapshotIsCurrent = snapshot => !!snapshot?.userId
    && snapshot.userId === activeUserId.current && authEpoch.current.isCurrent(snapshot.epoch);
  const clearPrivateState = () => {
    setAccount(null); setOwnPosts([]); setOwnComments([]); setModerationItems([]); setModerationCursor(null);
    setComments({}); setCommentCursors({}); setCommentText({}); setMyVotes({}); setAliasValue(''); setEditingOwnId(null);
    setEditingOwnCommentId(null); setOwnEditBody(''); setOwnCommentBody('');
    setActionError('');
    commentEpochs.current.clear(); moderationEpoch.current.advance(); setModerationBusy(false);
    setBusyActions({});
    setAccountSettingsOpen(false); setAliasBusy(false); setAliasMessage(''); setAliasError('');
    setSignOutBusy(false); setSignOutError('');
    setView(current => current === 'mine' || current === 'moderation' ? 'public' : current);
  };
  const applySession = (nextSession, event) => {
    const nextUserId = nextSession?.user?.id || null;
    const previousUserId = activeUserId.current;
    const identityChanged = event === 'SIGNED_OUT' || event === 'SIGNED_IN' || nextUserId !== previousUserId;
    if (identityChanged) { authEpoch.current.advance(); clearPrivateState(); }
    activeUserId.current = nextUserId;
    setSession(nextSession);
    if (!nextSession) clearPrivateState();
  };

  useEffect(() => {
    let cancelled = false;
    request('/capabilities').then(async data => {
      const client = data.authenticationAvailable ? await getAuthClient(data.auth) : null;
      if (cancelled) return;
      setCapabilities(data); setAuthClient(client);
      if (client) {
        const { data: { session: nextSession } } = await client.auth.getSession();
        if (!cancelled) applySession(nextSession, 'INITIAL_SESSION');
      }
    }).catch(() => { if (!cancelled) setCapabilities({ authenticationAvailable: false, publishingAvailable: false }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authClient) return undefined;
    const { data: { subscription } } = authClient.auth.onAuthStateChange((event, nextSession) => {
      applySession(nextSession, event);
    });
    return () => subscription.unsubscribe();
  }, [authClient]);

  useEffect(() => { setAliasValue(account?.displayName || ''); }, [account?.displayName]);
  useEffect(() => {
    const dialog = accountSettingsDialog.current;
    if (!dialog) return;
    if (accountSettingsOpen && !dialog.open) {
      dialog.showModal();
      aliasInput.current?.focus();
    } else if (!accountSettingsOpen && dialog.open) {
      dialog.close();
    }
  }, [accountSettingsOpen]);
  useEffect(() => {
    if ((view === 'mine' && !session) || (view === 'moderation' && (!session || !account?.isModerator))) setView('public');
  }, [view, session, account?.isModerator]);

  useEffect(() => {
    let cancelled = false;
    if (!session) { clearPrivateState(); return () => { cancelled = true; }; }
    const snapshot = authSnapshot();
    (async () => {
      try {
        const token = await currentToken(authClient);
        const [me, mine] = await Promise.all([request('/me', { token }), request('/mine', { token })]);
        if (!cancelled && authSnapshotIsCurrent(snapshot)) { setAccount(me.user); setOwnPosts(mine.posts || []); setOwnComments(mine.comments || []); }
      } catch { if (!cancelled && authSnapshotIsCurrent(snapshot)) setActionError('تعذر تحميل بيانات الحساب حالياً.'); }
    })();
    return () => { cancelled = true; };
  }, [session, authClient]);

  useEffect(() => {
    let cancelled = false;
    const requestEpoch = feedEpoch.current.advance();
    setFeedState('loading');
    setFeedCursor(null); setPublicPosts([]);
    setBusyActions(value => ({ ...value, more: false }));
    const params = new URLSearchParams({ category, limit: '20' });
    if (query.trim()) params.set('q', query.trim());
    request(`/posts?${params.toString()}`).then(payload => {
      if (cancelled || !feedEpoch.current.isCurrent(requestEpoch)) return;
      if (!Array.isArray(payload.posts) || !('nextCursor' in payload)) throw new Error('invalid-response');
      setPublicPosts(payload.posts.filter(post => post && typeof post.id === 'string'
        && typeof post.routeId === 'string' && COMMUNITY_CATEGORIES.includes(post.category)
        && typeof post.body === 'string' && typeof post.createdAt === 'string'));
      setFeedCursor(payload.nextCursor || null); setFeedState('ready');
    }).catch(() => { if (!cancelled && feedEpoch.current.isCurrent(requestEpoch)) setFeedState('unavailable'); });
    return () => { cancelled = true; };
  }, [category, query, refresh]);

  useEffect(() => {
    if (!session || !publicPosts.length) { setMyVotes({}); return undefined; }
    let cancelled = false;
    const snapshot = authSnapshot();
    Promise.all(publicPosts.map(async post => {
      try { const data = await authenticatedRequest(`/posts/${encodeURIComponent(post.id)}/vote`); return [post.id, data.value]; }
      catch { return [post.id, 0]; }
    })).then(entries => {
      if (!cancelled && authSnapshotIsCurrent(snapshot)) setMyVotes(value => ({ ...value, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [session?.user?.id, publicPosts]);

  const loadMore = async () => {
    if (!feedCursor || busyActions.more) return;
    const cursor = feedCursor, requestEpoch = feedEpoch.current.capture();
    setBusyActions(value => ({ ...value, more: true }));
    try {
      const params = new URLSearchParams({ category, limit: '20', cursor });
      if (query.trim()) params.set('q', query.trim());
      const payload = await request(`/posts?${params}`);
      if (feedEpoch.current.isCurrent(requestEpoch)) { setPublicPosts(items => appendUniqueById(items, payload.posts || [])); setFeedCursor(payload.nextCursor || null); }
    } catch { if (feedEpoch.current.isCurrent(requestEpoch)) setActionError('تعذر تحميل المزيد من التحديثات.'); }
    finally { if (feedEpoch.current.isCurrent(requestEpoch)) setBusyActions(value => ({ ...value, more: false })); }
  };

  const submitDraft = async draft => {
    if (busyActions[`submit:${draft.id}`]) return;
    const snapshot = authSnapshot();
    setBusyActions(value => ({ ...value, [`submit:${draft.id}`]: true }));
    setActionError('');
    try {
      const payload = await authenticatedRequest('/posts', { method: 'POST', body: { routeId: draft.routeId, category: draft.category, body: draft.body } });
      if (!authSnapshotIsCurrent(snapshot)) return;
      const result = deleteDraft(draft.id);
      if (result.ok) setDraftStore({ ok: true, drafts: result.drafts });
      setOwnPosts(items => [payload.post, ...items]); setView('mine');
      setDraftActionMessage(text(lang, 'أُرسل التحديث للمراجعة. سيظهر للعامة بعد الموافقة.', 'Sent for review. It will appear publicly after approval.'));
      setDraftActionError(false);
    } catch (error) {
      if (authSnapshotIsCurrent(snapshot)) setActionError(error.code === 'DisplayNameRequired' ? 'اختر اسماً عاماً في حسابك قبل الإرسال.' : 'تعذر إرسال التحديث. بقيت المسودة محفوظة على هذا الجهاز.');
    } finally { if (authSnapshotIsCurrent(snapshot)) setBusyActions(value => ({ ...value, [`submit:${draft.id}`]: false })); }
  };

  const openComments = async postId => {
    const controller = commentEpochs.current.get(postId) || createEpochController();
    commentEpochs.current.set(postId, controller);
    const requestEpoch = controller.advance();
    setBusyActions(value => ({ ...value, [`comments:${postId}`]: false }));
    try { const data = await request(`/posts/${encodeURIComponent(postId)}/comments?limit=20`); if (controller.isCurrent(requestEpoch)) { setComments(value => ({ ...value, [postId]: data.comments || [] })); setCommentCursors(value => ({ ...value, [postId]: data.nextCursor || null })); } }
    catch { if (controller.isCurrent(requestEpoch)) setActionError('تعذر تحميل التعليقات.'); }
  };
  const loadMoreComments = async postId => {
    const cursor = commentCursors[postId]; if (!cursor || busyActions[`comments:${postId}`]) return;
    const controller = commentEpochs.current.get(postId); if (!controller) return;
    const requestEpoch = controller.capture();
    setBusyActions(value => ({ ...value, [`comments:${postId}`]: true }));
    try { const params = new URLSearchParams({ limit: '20', cursor }); const data = await request(`/posts/${encodeURIComponent(postId)}/comments?${params}`); if (controller.isCurrent(requestEpoch)) { setComments(value => ({ ...value, [postId]: appendUniqueById(value[postId] || [], data.comments || []) })); setCommentCursors(value => ({ ...value, [postId]: data.nextCursor || null })); } }
    catch { if (controller.isCurrent(requestEpoch)) setActionError('تعذر تحميل المزيد من التعليقات.'); }
    finally { if (controller.isCurrent(requestEpoch)) setBusyActions(value => ({ ...value, [`comments:${postId}`]: false })); }
  };
  const sendComment = async postId => {
    if (!session) { setActionError('سجّل الدخول لإضافة تعليق.'); return; }
    const body = commentText[postId]?.trim(); if (!body) return;
    if (busyActions[`comment:${postId}`]) return;
    const snapshot = authSnapshot();
    setBusyActions(value => ({ ...value, [`comment:${postId}`]: true }));
    try { const data = await authenticatedRequest(`/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: { body } }); if (authSnapshotIsCurrent(snapshot)) { if (data.comment) setOwnComments(items => appendUniqueById([data.comment, ...items], [])); setCommentText(value => ({ ...value, [postId]: '' })); setActionError('أُرسل التعليق للمراجعة.'); } }
    catch { if (authSnapshotIsCurrent(snapshot)) setActionError('تعذر إرسال التعليق للمراجعة.'); }
    finally { if (authSnapshotIsCurrent(snapshot)) setBusyActions(value => ({ ...value, [`comment:${postId}`]: false })); }
  };
  const vote = async (postId, value) => {
    if (!session) { setActionError('سجّل الدخول للتصويت.'); return; }
    if (busyActions[`vote:${postId}`]) return;
    const snapshot = authSnapshot();
    setBusyActions(state => ({ ...state, [`vote:${postId}`]: true }));
    try { const data = await authenticatedRequest(`/posts/${encodeURIComponent(postId)}/vote`, { method: 'PUT', body: { value } }); if (authSnapshotIsCurrent(snapshot)) { setMyVotes(current => ({ ...current, [postId]: data.value })); setPublicPosts(items => items.map(post => post.id === postId ? { ...post, voteScore: data.voteScore } : post)); } }
    catch { if (authSnapshotIsCurrent(snapshot)) setActionError('تعذر تسجيل التصويت.'); }
    finally { if (authSnapshotIsCurrent(snapshot)) setBusyActions(state => ({ ...state, [`vote:${postId}`]: false })); }
  };
  const selectCategory = value => { if (value === category) return; advanceIfChanged(feedEpoch.current, category, value); setBusyActions(current => ({ ...current, more: false })); setCategory(value); };
  const changeQuery = value => { if (value === query) return; advanceIfChanged(feedEpoch.current, query, value); setBusyActions(current => ({ ...current, more: false })); setQuery(value); };
  const changeModerationFilter = (kind, status) => { moderationEpoch.current.advance(); setModerationBusy(false); setModerationItems([]); setModerationCursor(null); setModerationKind(kind); setModerationStatus(status); };
  const voteValueFor = (postId, value) => myVotes[postId] === value ? 0 : value;
  const loadModeration = async () => {
    if (!session || !account?.isModerator) return;
    const snapshot = authSnapshot();
    const requestEpoch = moderationEpoch.current.advance();
    const kind = moderationKind, status = moderationStatus;
    setModerationBusy(true); setModerationCursor(null); setModerationItems([]);
    try {
      const data = await authenticatedRequest(`/moderation?kind=${kind}&status=${status}&limit=20`);
      if (authSnapshotIsCurrent(snapshot) && moderationEpoch.current.isCurrent(requestEpoch)) { setModerationItems(data.items || []); setModerationCursor(data.nextCursor || null); }
    } catch { if (authSnapshotIsCurrent(snapshot) && moderationEpoch.current.isCurrent(requestEpoch)) setActionError('تعذر تحميل قائمة المراجعة.'); }
    finally { if (authSnapshotIsCurrent(snapshot) && moderationEpoch.current.isCurrent(requestEpoch)) setModerationBusy(false); }
  };
  const loadMoreModeration = async () => {
    const cursor = moderationCursor;
    if (!cursor || moderationBusy || !session || !account?.isModerator) return;
    const snapshot = authSnapshot(), requestEpoch = moderationEpoch.current.capture();
    const kind = moderationKind, status = moderationStatus;
    setModerationBusy(true);
    try {
      const params = new URLSearchParams({ kind, status, limit: '20', cursor });
      const data = await authenticatedRequest(`/moderation?${params}`);
      if (authSnapshotIsCurrent(snapshot) && moderationEpoch.current.isCurrent(requestEpoch)) {
        setModerationItems(items => appendUniqueById(items, data.items || [])); setModerationCursor(data.nextCursor || null);
      }
    } catch { if (authSnapshotIsCurrent(snapshot) && moderationEpoch.current.isCurrent(requestEpoch)) setActionError('تعذر تحميل المزيد من عناصر المراجعة.'); }
    finally { if (authSnapshotIsCurrent(snapshot) && moderationEpoch.current.isCurrent(requestEpoch)) setModerationBusy(false); }
  };
  const moderate = async (item, status) => {
    const busyKey = `moderate:${item.targetType || moderationKind}:${item.id}`;
    if (busyActions[busyKey]) return;
    const snapshot = authSnapshot(), requestEpoch = moderationEpoch.current.capture();
    setBusyActions(value => ({ ...value, [busyKey]: true }));
    const targetType = item.targetType || (moderationKind === 'comments' ? 'comment' : 'post');
    try {
      await authenticatedRequest('/moderation', { method: 'PATCH', body: { targetType, id: item.id, status, expectedRevision: item.revision } });
      if (authSnapshotIsCurrent(snapshot) && moderationEpoch.current.isCurrent(requestEpoch)) {
        setModerationItems(items => items.filter(row => row.id !== item.id));
        setOwnPosts(items => applyModerationDecision({ posts: items }, targetType, item.id, status).posts);
        setOwnComments(items => applyModerationDecision({ comments: items }, targetType, item.id, status).comments);
        if (targetType === 'post' && status !== 'approved') {
          setPublicPosts(items => applyModerationDecision({ posts: [], publicPosts: items }, targetType, item.id, status).publicPosts);
        }
      }
    }
    catch (error) { if (!authSnapshotIsCurrent(snapshot) || !moderationEpoch.current.isCurrent(requestEpoch)) return; if (error.status === 409 || error.code === 'Conflict') { setActionError('تغير المحتوى، أعد تحميل قائمة المراجعة.'); setBusyActions(value => ({ ...value, [busyKey]: false })); await loadModeration(); } else setActionError('تعذر تحديث حالة المراجعة.'); }
    finally { if (authSnapshotIsCurrent(snapshot) && moderationEpoch.current.isCurrent(requestEpoch)) setBusyActions(value => ({ ...value, [busyKey]: false })); }
  };

  useEffect(() => { setDraftStore(readDraftStore()); }, []);

  const routesForPicker = useMemo(() => {
    const normalized = routeQuery.trim().toLocaleLowerCase();
    return routes.filter(route => {
      if (!normalized) return true;
      const routeSearchable = normalizeDirectorySearch([
        routeTitle(route, lang), route.num, route.short_ar, route.short_en,
        route.origin_ar, route.dest_ar, route.origin, route.dest, route.origin_en, route.dest_en,
        ...(route.via_stops || []), ...(route.via_stops_en || []),
      ].filter(Boolean).join(' '));
      return normalizeDirectorySearch(normalized).split(' ').filter(Boolean).every(token => routeSearchable.includes(token));
    }).slice(0, 40);
  }, [routes, routeQuery, lang]);

  const visibleItems = useMemo(() => {
    const items = view === 'drafts' ? draftStore.drafts : view === 'mine' ? ownPosts : publicPosts;
    return items.filter(item => (category === 'ALL' || item.category === category)
      && matchesSearch(item, query, routes.find(route => route.id === item.routeId)));
  }, [view, draftStore.drafts, publicPosts, ownPosts, category, query, routes]);

  const resetForm = () => {
    setIsComposerOpen(false);
    setEditingId(null); setBody(''); setSelectedRouteId(''); setRouteQuery('');
    setDraftCategory('fare'); setRouteMenuOpen(false); setFormMessage(''); setFormError(false);
  };

  const handleSave = event => {
    event.preventDefault();
    setFormMessage(''); setFormError(false);
    const result = editingId
      ? updateDraft(editingId, { routeId: selectedRouteId, category: draftCategory, body })
      : addDraft({ routeId: selectedRouteId, category: draftCategory, body });
    if (!result.ok) {
      setFormError(true);
      setFormMessage(result.error === 'limit'
        ? text(lang, 'وصلت إلى الحد الأقصى وهو 50 مسودة على هذا الجهاز.', 'This device has reached the 50-draft limit.')
        : result.error === 'unavailable' || result.error === 'invalid'
          ? text(lang, 'تعذر حفظ المسودة. قد تكون مساحة التخزين الخاصة معطلة أو البيانات غير صالحة. بقي النص في النموذج؛ انسخه قبل إعادة تحميل الصفحة.', 'The draft could not be saved. Private storage may be unavailable or the saved data may be invalid. Your text is still in the form; copy it before reloading.')
          : text(lang, 'تعذر حفظ المسودة. بقي النص في النموذج.', 'Could not save the draft. Your text is still in the form.'));
      setDraftStore(readDraftStore());
      return;
    }
    setDraftStore({ ok: true, drafts: result.drafts });
    setDraftActionMessage(text(lang, 'حُفظت المسودة على هذا الجهاز فقط. لم تُنشر.', 'Saved on this device only. Nothing was published.'));
    setDraftActionError(false);
    setEditingId(null);
    setBody(''); setSelectedRouteId(''); setRouteQuery(''); setRouteMenuOpen(false);
    setView('drafts');
    setIsComposerOpen(false);
  };

  const editingDraft = editingId ? draftStore.drafts.find(draft => draft.id === editingId) : null;
  const canKeepUnavailableDraftRoute = !!editingDraft && selectedRouteId === editingDraft.routeId;

  const startEdit = draft => {
    setIsComposerOpen(true);
    setEditingId(draft.id); setBody(draft.body); setSelectedRouteId(draft.routeId);
    const route = routes.find(item => item.id === draft.routeId);
    setRouteQuery(route ? routeTitle(route, lang) : ''); setDraftCategory(draft.category);
    setFormMessage(''); setFormError(false);
  };

  const removeDraft = id => {
    const result = deleteDraft(id);
    if (result.ok) {
      setDraftStore({ ok: true, drafts: result.drafts });
      setDraftActionMessage(text(lang, 'حُذفت المسودة من هذا الجهاز.', 'Draft deleted from this device.'));
      setDraftActionError(false);
      if (editingId === id) resetForm();
    } else {
      setDraftActionMessage(text(lang, 'تعذر حذف المسودة من التخزين على هذا الجهاز.', 'Could not delete the draft from this device storage.'));
      setDraftActionError(true);
    }
  };

  const openRoute = routeId => {
    const route = routes.find(item => item.id === routeId);
    if (route && onSelectRoute) onSelectRoute(route);
  };
  const savePublicAlias = async event => {
    event.preventDefault();
    const displayName = aliasValue.trim();
    if (displayName.length < 2 || displayName.length > 80) {
      setAliasError(text(lang, 'اختر اسماً عاماً من حرفين إلى 80 حرفاً.', 'Choose a public name between 2 and 80 characters.'));
      setAliasMessage('');
      return;
    }
    if (aliasBusy || signOutBusy) return;
    const snapshot = authSnapshot();
    setAliasBusy(true); setAliasError(''); setAliasMessage('');
    try {
      const data = await authenticatedRequest('/me', { method: 'PATCH', body: { displayName } });
      if (!authSnapshotIsCurrent(snapshot)) return;
      setAccount(data.user); setAliasValue(data.user.displayName);
      setActionError(''); setAliasMessage(text(lang, 'تم حفظ الاسم العام.', 'Public name saved.'));
    } catch (error) {
      if (!error.stale && authSnapshotIsCurrent(snapshot)) {
        setAliasError(error.status === 400 || error.code === 'InvalidDisplayName'
          ? text(lang, 'اختر اسماً عاماً من حرفين إلى 80 حرفاً.', 'Choose a public name between 2 and 80 characters.')
          : text(lang, 'تعذر حفظ الاسم العام. تحقق من الاتصال وحاول مرة أخرى.', 'Could not save the public name. Check your connection and try again.'));
      }
    } finally {
      if (authSnapshotIsCurrent(snapshot)) setAliasBusy(false);
    }
  };
  const signOut = async () => {
    if (signOutBusy || aliasBusy || !authClient) return;
    const snapshot = authSnapshot();
    setSignOutBusy(true); setSignOutError('');
    try {
      const { error } = await authClient.auth.signOut({ scope: 'local' });
      if (error) throw error;
      if (authSnapshotIsCurrent(snapshot)) applySession(null, 'SIGNED_OUT');
    } catch {
      if (authSnapshotIsCurrent(snapshot)) setSignOutError(text(lang, 'تعذر تسجيل الخروج. تحقق من الاتصال وحاول مرة أخرى.', 'Could not sign out. Check your connection and try again.'));
    } finally {
      if (authSnapshotIsCurrent(snapshot)) setSignOutBusy(false);
    }
  };
  const hasFeedFilters = !!query.trim() || category !== 'ALL';
  const emptyStateTitle = view === 'drafts'
    ? (draftStore.drafts.length ? text(lang, 'لا توجد مسودات تطابق التصفية', 'No drafts match these filters') : text(lang, 'لا توجد مسودات بعد', 'No drafts yet'))
    : view === 'mine'
      ? (hasFeedFilters ? text(lang, 'لا توجد منشورات تطابق التصفية', 'No posts match these filters') : text(lang, 'لم ترسل منشورات بعد', 'You have not sent any posts yet'))
      : hasFeedFilters ? text(lang, 'لا توجد نتائج مطابقة', 'No matching updates') : text(lang, 'لا توجد تحديثات بعد', 'No updates yet');
  const emptyStateDescription = view === 'drafts'
    ? text(lang, 'احفظ تحديثاً كمسودة لتعود إليه في أي وقت.', 'Save an update as a draft to come back to it anytime.')
    : view === 'mine'
      ? (hasFeedFilters ? text(lang, 'جرّب تغيير كلمات البحث أو اختيار نوع آخر.', 'Try changing your search or choosing another category.') : text(lang, 'أرسل مسودة للمراجعة لتتابع حالتها هنا.', 'Submit a draft for review to follow its status here.'))
      : hasFeedFilters ? text(lang, 'جرّب تغيير كلمات البحث أو اختيار نوع آخر.', 'Try different search words or choose another category.') : text(lang, 'ستظهر هنا التحديثات العامة بعد اعتمادها.', 'Public updates will appear here after review.');

  return (
    <section className={`community-hub${variant === 'page' ? ' community-hub-page' : ''}`} dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="community-head">
        <div className="community-brand"><span className="community-brand-icon"><Bus size={19} /></span>
          <div><h2>{text(lang, 'مجتمع الركاب', 'Rider community')}</h2><p>{text(lang, 'تحديثات عامة ومسودات محفوظة على جهازك', 'Public updates and drafts stored on your device')}</p></div>
        </div>
      <div className="community-account" aria-label="الحساب والمشاركة">
        {!session ? <><p className="community-readonly" role="status">{capabilities?.authenticationAvailable ? 'سجّل الدخول للمشاركة. اختر اسماً عاماً بنفسك؛ لن نستخدم اسم Google أو بريدك.' : 'المجتمع متاح للقراءة. تسجيل الدخول والمشاركة غير مهيئين حالياً.'}</p>
          {capabilities?.authenticationAvailable && <button type="button" className="community-primary" onClick={async () => { try { const { error } = await signInWithGoogle(authClient); if (error) throw error; } catch { setActionError('تعذر بدء تسجيل الدخول. حاول مرة أخرى.'); } }}>تسجيل الدخول عبر Google</button>}
        </> : <button ref={accountSettingsButton} type="button" className="community-account-button" onClick={() => {
          setAliasValue(account?.displayName || ''); setAliasError(''); setAliasMessage(''); setSignOutError(''); setAccountSettingsOpen(true);
        }} aria-haspopup="dialog" aria-label={text(lang, 'إعدادات الحساب', 'Account settings')}>
          <span>{account?.displayName || text(lang, 'حسابي', 'My account')}</span><Settings size={18} aria-hidden="true" />
        </button>}
      </div>
      <dialog ref={accountSettingsDialog} className="community-account-dialog" aria-labelledby="community-account-dialog-title" onCancel={() => setAccountSettingsOpen(false)} onClose={() => {
        if (accountSettingsOpen) setAccountSettingsOpen(false);
        if (accountSettingsButton.current?.isConnected) accountSettingsButton.current.focus();
      }}>
        <div className="community-account-dialog-head">
          <div><h3 id="community-account-dialog-title">{text(lang, 'إعدادات الحساب', 'Account settings')}</h3><p>{text(lang, 'اختر الاسم الذي سيظهر للآخرين في المجتمع.', 'Choose the name others will see in the community.')}</p></div>
          <button type="button" className="community-icon-button" aria-label={text(lang, 'إغلاق إعدادات الحساب', 'Close account settings')} onClick={() => setAccountSettingsOpen(false)}><X size={18} /></button>
        </div>
        <form className="community-alias" onSubmit={savePublicAlias}>
          <label htmlFor="community-alias">{text(lang, 'الاسم الظاهر للعامة', 'Public name')}</label>
          <input ref={aliasInput} id="community-alias" name="displayName" value={aliasValue} onChange={event => { setAliasValue(event.target.value); setAliasError(''); setAliasMessage(''); }} maxLength={80} minLength={2} autoComplete="off" placeholder={text(lang, 'اختر اسماً عاماً', 'Choose a public name')} disabled={aliasBusy || signOutBusy}/>
          <span className="community-field-help">{text(lang, 'من حرفين إلى 80 حرفاً. لن نستخدم اسم Google أو بريدك.', '2–80 characters. Your Google name and email will not be used.')}</span>
          {aliasError && <p className="community-form-message error" role="alert">{aliasError}</p>}
          {aliasMessage && <p className="community-form-message" role="status">{aliasMessage}</p>}
          <button className="community-primary" type="submit" disabled={aliasBusy || signOutBusy}>{aliasBusy ? text(lang, 'جارٍ الحفظ…', 'Saving…') : text(lang, 'حفظ الاسم العام', 'Save public name')}</button>
        </form>
        <div className="community-account-signout">
          <h4>{text(lang, 'تسجيل الخروج', 'Sign out')}</h4><p>{text(lang, 'سيتم تسجيل الخروج من هذا الجهاز.', 'You will be signed out on this device.')}</p>
          {signOutError && <p className="community-form-message error" role="alert">{signOutError}</p>}
          <button type="button" className="community-secondary" onClick={signOut} disabled={signOutBusy || aliasBusy}><LogOut size={16} aria-hidden="true" />{signOutBusy ? text(lang, 'جارٍ تسجيل الخروج…', 'Signing out…') : text(lang, 'تسجيل الخروج', 'Sign out')}</button>
        </div>
      </dialog>
      {actionError && <p role="alert" className="community-form-message error">{actionError}</p>}
      </header>

      {!draftStore.ok && <p className="community-storage-notice" role="alert">{text(lang, 'تعذرت قراءة المسودات المحفوظة. قد تكون بيانات التخزين تالفة أو غير متاحة؛ لن ندّعي حفظ التغييرات.', 'Saved drafts could not be read. Storage may be unavailable or corrupted; changes will not be described as saved.')}</p>}
      {draftActionMessage && <p className={`community-form-message ${draftActionError ? 'error' : ''}`} role={draftActionError ? 'alert' : 'status'}>{draftActionMessage}</p>}

      <div className="community-toolbar">
      <div className="community-view-tabs" role="group" aria-label={text(lang, 'أقسام المجتمع', 'Community views')}>
        <button type="button" aria-pressed={view === 'public'} onClick={() => setView('public')}>{text(lang, 'التحديثات العامة', 'Public updates')}</button>
        <button type="button" aria-pressed={view === 'drafts'} onClick={() => setView('drafts')}>{text(lang, 'مسوداتي', 'My drafts')} <span>{draftStore.drafts.length}</span></button>
        {session && <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>إرسالاتي</button>}
        {session && account?.isModerator && <button type="button" aria-pressed={view === 'moderation'} onClick={() => { setView('moderation'); loadModeration(); }}>المراجعة</button>}
      </div>
      {!isComposerOpen ? <button type="button" className="community-new-draft" onClick={() => { resetForm(); setIsComposerOpen(true); }}><Plus size={17} />{text(lang, 'مسودة جديدة', 'New draft')}</button> : null}
      </div>
      {isComposerOpen && <section className="community-composer" aria-labelledby="community-composer-title">
        <div className="community-section-title"><div><h3 id="community-composer-title">{editingId ? text(lang, 'تعديل مسودة', 'Edit draft') : text(lang, 'مسودة تحديث', 'Draft an update')}</h3>
          <p>{text(lang, 'تُحفظ على هذا الجهاز فقط، ولن تظهر كتحديث عام.', 'Saved on this device only; it will not appear as a public update.')}</p></div>
          <button type="button" className="community-icon-button" onClick={resetForm} aria-label={editingId ? text(lang, 'إلغاء التعديل', 'Cancel editing') : text(lang, 'إغلاق المسودة', 'Close draft')}><X size={17} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="community-form-grid">
            <div className="community-field">
              <label htmlFor="community-route-search">{text(lang, 'المسار الدقيق والاتجاه', 'Exact route and direction')}</label>
              <div className="community-route-picker">
                <input id="community-route-search" type="search" value={routeQuery} placeholder={text(lang, 'ابحث برقم الخط أو النهايات', 'Search route number or endpoints')}
                  onFocus={() => setRouteMenuOpen(true)} onChange={event => { setRouteQuery(event.target.value); setSelectedRouteId(''); setRouteMenuOpen(true); }}
                  aria-expanded={routeMenuOpen} aria-controls="community-route-options" autoComplete="off" />
                {routeMenuOpen && <div className="community-route-options" id="community-route-options" role="listbox">
                  {routesForPicker.length ? routesForPicker.map(route => <button type="button" role="option" aria-selected={route.id === selectedRouteId} key={route.id}
                    onClick={() => { setSelectedRouteId(route.id); setRouteQuery(routeTitle(route, lang)); setRouteMenuOpen(false); }}>
                    <span>{routeTitle(route, lang)}</span>
                  </button>) : <p>{text(lang, 'لا توجد مسارات مطابقة.', 'No matching routes.')}</p>}
                </div>}
              </div>
              {selectedRoute && <small className="community-field-help">{text(lang, 'المسار والاتجاه المحددان', 'Selected route and direction')}: {routeTitle(selectedRoute, lang)}</small>}
              {editingId && !selectedRoute && <small className="community-field-help">{text(lang, 'المسار الأصلي غير متاح حالياً؛ يمكنك تعديل النص والنوع مع الاحتفاظ بمعرّف المسار الأصلي.', 'The original route is unavailable. You can edit the text and category while keeping its route ID.')}</small>}
            </div>
            <label className="community-field">{text(lang, 'نوع التحديث', 'Update type')}
              <select value={draftCategory} onChange={event => setDraftCategory(event.target.value)}>{COMMUNITY_CATEGORIES.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select>
            </label>
          </div>
          <label className="community-field">{text(lang, 'التفاصيل', 'Details')}
            <textarea value={body} onChange={event => setBody(event.target.value.slice(0, COMMUNITY_BODY_LIMIT))} maxLength={COMMUNITY_BODY_LIMIT} rows={4}
              placeholder={text(lang, 'اكتب تحديثاً واضحاً للمسافرين…', 'Write a clear update for riders…')} />
            <small className="community-field-help">{body.length}/{COMMUNITY_BODY_LIMIT}</small>
          </label>
          {formMessage && <p className={`community-form-message ${formError ? 'error' : ''}`} role={formError ? 'alert' : 'status'}>{formMessage}</p>}
          <div className="community-form-actions">
            <button type="submit" className="community-primary" disabled={!body.trim() || (!editingId && !selectedRouteId) || (editingId && !selectedRoute && !canKeepUnavailableDraftRoute)}><Plus size={16} />{editingId ? text(lang, 'حفظ التعديل', 'Save changes') : text(lang, 'حفظ كمسودة', 'Save draft')}</button>
            <button type="button" className="community-secondary" onClick={resetForm}>{text(lang, 'إلغاء', 'Cancel')}</button>
          </div>
        </form>
      </section>}

      <section className="community-filter-panel" aria-label={text(lang, 'البحث والتصفية', 'Search and filters')}><div className="community-filters">
        <label className="community-search"><Search size={16} /><input type="search" value={query} maxLength={120} onChange={event => changeQuery(event.target.value.slice(0, 120))} placeholder={text(lang, 'ابحث في نص التحديثات', 'Search update text')} aria-label={text(lang, 'ابحث في نص التحديثات', 'Search update text')} />
          {query && <button type="button" onClick={() => changeQuery('')} aria-label={text(lang, 'مسح البحث', 'Clear search')}><X size={15} /></button>}
        </label>
        <div className="community-filter-chips" aria-label={text(lang, 'تصفية حسب النوع', 'Filter by category')}>
          {[['ALL', text(lang, 'الكل', 'All')], ...['fare', 'detour', 'tip', 'frequency', 'route'].map(value => [value, labels[value]])].map(([value, label]) => <button key={value} type="button" aria-pressed={category === value} onClick={() => selectCategory(value)}>{label}</button>)}
        </div>
      </div></section>

      <section className="community-feed" aria-live="polite">
        <div className="community-feed-title"><h3>{view === 'drafts' ? text(lang, 'مسوداتي على هذا الجهاز', 'My device drafts') : view === 'mine' ? 'إرسالاتي وحالات مراجعتها' : view === 'moderation' ? 'قائمة مراجعة المنشورات' : text(lang, 'التحديثات العامة', 'Public updates')}</h3>
        </div>
        {view === 'moderation' && session && account?.isModerator ? <><div className="community-form-actions"><label>النوع <select value={moderationKind} onChange={event => changeModerationFilter(event.target.value, moderationStatus)}>{[['posts','منشورات'],['comments','تعليقات']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>الحالة <select value={moderationStatus} onChange={event => changeModerationFilter(moderationKind, event.target.value)}>{['pending','approved','rejected','hidden'].map(v => <option key={v} value={v}>{statusLabel(v)}</option>)}</select></label><button className="community-secondary" type="button" onClick={loadModeration} disabled={moderationBusy}>تحميل</button></div>{moderationBusy && <div className="community-state" role="status">جارٍ تحميل قائمة المراجعة…</div>}{moderationItems.length ? moderationItems.map(item => <article className="community-post" key={item.id}><span className="community-category">{statusLabel(item.status)}</span><p className="community-post-body">{item.body}</p><div className="community-form-actions"><button className="community-primary" type="button" onClick={() => moderate(item, 'approved')}>موافقة</button><button className="community-secondary" type="button" onClick={() => moderate(item, 'rejected')}>رفض</button><button className="community-secondary" type="button" onClick={() => moderate(item, 'hidden')}>إخفاء</button></div></article>) : !moderationBusy && <div className="community-state">لا توجد عناصر للمراجعة.</div>}{moderationCursor && <button className="community-secondary" type="button" disabled={moderationBusy} onClick={loadMoreModeration}>تحميل المزيد للمراجعة</button>}</> : null}
        {view === 'mine' && session && ownComments.map(comment => <article className="community-post" key={`comment-${comment.id}`}><span className="community-category">تعليق · {statusLabel(comment.status)}</span>{editingOwnCommentId === comment.id ? <form className="community-own-edit" onSubmit={async event => { event.preventDefault(); try { const data = await authenticatedRequest(`/comments/${encodeURIComponent(comment.id)}`, { method: 'PATCH', body: { body: ownCommentBody } }); setOwnComments(items => items.map(row => row.id === comment.id ? (data.comment || { ...row, body: ownCommentBody, status: 'pending' }) : row)); setEditingOwnCommentId(null); } catch (error) { if (!error.stale) setActionError('تعذر حفظ التعليق.'); } }}><textarea value={ownCommentBody} maxLength={1000} onChange={event => setOwnCommentBody(event.target.value)}/><button type="submit" className="community-primary">حفظ وإعادة المراجعة</button><button type="button" className="community-secondary" onClick={() => setEditingOwnCommentId(null)}>إلغاء</button></form> : <><p className="community-post-body">{comment.body}</p><div className="community-form-actions"><button type="button" className="community-secondary" onClick={() => { setEditingOwnCommentId(comment.id); setOwnCommentBody(comment.body); }}>تعديل وإعادة المراجعة</button><button type="button" className="community-secondary" onClick={async () => { try { await authenticatedRequest(`/comments/${encodeURIComponent(comment.id)}`, { method: 'DELETE' }); setOwnComments(items => items.filter(row => row.id !== comment.id)); } catch (error) { if (!error.stale) setActionError('تعذر حذف التعليق.'); } }}>حذف التعليق</button></div></>}</article>)}
        {view !== 'moderation' && (view !== 'mine' || session) && (view === 'public' && feedState === 'loading' ? <div className="community-state" role="status"><LoaderCircle className="community-spin" size={22} />{text(lang, 'جارٍ تحميل التحديثات العامة…', 'Loading public updates…')}</div>
          : view === 'public' && feedState === 'unavailable' ? <div className="community-state community-state-error" role="alert"><p>{text(lang, 'التحديثات العامة غير متاحة حالياً. يمكنك حفظ مسوداتك على هذا الجهاز.', 'Public updates are unavailable right now. You can save drafts on this device.')}</p><button type="button" className="community-secondary" onClick={() => setRefresh(value => value + 1)}>{text(lang, 'إعادة المحاولة', 'Retry')}</button></div>
            : !visibleItems.length ? <div className="community-state community-empty-card"><span className="community-empty-icon" aria-hidden="true"><Inbox size={22} /></span><h4>{emptyStateTitle}</h4><p>{emptyStateDescription}</p></div>
              : visibleItems.map(item => {
                const route = routes.find(candidate => candidate.id === item.routeId);
                const isDraft = view === 'drafts'; const isOwn = view === 'mine';
                return <article className="community-post" key={item.id}>
                  <div className="community-post-meta"><span className="community-category">{labels[item.category]}</span>
                    <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </div>
                  {route ? <a className="community-post-route" href={`/app?route=${encodeURIComponent(route.id)}`} onClick={onOpenPlanner || (onSelectRoute ? event => { event.preventDefault(); openRoute(item.routeId); } : undefined)}><Bus size={15} />{routeTitle(route, lang)}<ArrowUpRight size={14} /></a>
                    : <p className="community-post-route unavailable"><Bus size={15} />{text(lang, 'المسار الأصلي غير متاح في بيانات المسارات الحالية', 'Original route is unavailable in the current route data')}</p>}
                  <p className="community-post-body">{item.body}</p>
                  <div className="community-post-footer">{isDraft ? <><span>{text(lang, 'مسودة خاصة على هذا الجهاز', 'Private draft on this device')}</span><div><button type="button" onClick={() => startEdit(item)}>{text(lang, 'تعديل', 'Edit')}</button><button type="button" className="danger" onClick={() => removeDraft(item.id)}><Trash2 size={14} />{text(lang, 'حذف', 'Delete')}</button><button type="button" disabled={!session || !capabilities?.publishingAvailable || busyActions[`submit:${item.id}`]} onClick={() => submitDraft(item)}>{busyActions[`submit:${item.id}`] ? 'جارٍ الإرسال…' : 'إرسال للمراجعة'}</button></div></>
                    : item.authorDisplayName ? <span>{item.authorDisplayName}{isOwn ? ` · ${statusLabel(item.status)}` : ''}</span> : null}</div>
                  {isOwn && <div className="community-form-actions"><button type="button" className="community-secondary" onClick={() => { setEditingOwnId(item.id); setOwnEditBody(item.body); }}>تعديل وإعادة الإرسال للمراجعة</button><button type="button" className="community-secondary" onClick={async () => { try { await authenticatedRequest(`/posts/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); setOwnPosts(items => items.filter(row => row.id !== item.id)); } catch (error) { if (!error.stale) setActionError('تعذر حذف الإرسال.'); } }}>حذف الإرسال</button></div>}
                  {isOwn && editingOwnId === item.id && <form className="community-own-edit" onSubmit={async event => { event.preventDefault(); try { const data = await authenticatedRequest(`/posts/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: { routeId: item.routeId, category: item.category, body: ownEditBody } }); setOwnPosts(items => items.map(row => row.id === item.id ? data.post : row)); setEditingOwnId(null); } catch (error) { if (!error.stale) setActionError('تعذر حفظ التعديل.'); } }}><textarea value={ownEditBody} maxLength={COMMUNITY_BODY_LIMIT} onChange={event => setOwnEditBody(event.target.value)}/><button type="submit" className="community-primary">حفظ وإعادة المراجعة</button></form>}
                  {!isDraft && !isOwn && view === 'public' && <div className="community-social"><button type="button" aria-pressed={myVotes[item.id] === 1} disabled={busyActions[`vote:${item.id}`]} onClick={() => vote(item.id, voteValueFor(item.id, 1))} aria-label="تصويت إيجابي أو إلغاء التصويت">▲ {item.voteScore ?? 0}</button><button type="button" aria-pressed={myVotes[item.id] === -1} disabled={busyActions[`vote:${item.id}`]} onClick={() => vote(item.id, voteValueFor(item.id, -1))} aria-label="تصويت سلبي أو إلغاء التصويت">▼</button><button type="button" onClick={() => openComments(item.id)}>التعليقات ({item.commentCount ?? 0})</button></div>}
                  {comments[item.id] && <div className="community-comments">{comments[item.id].map(comment => <p key={comment.id}><strong>{comment.authorDisplayName}</strong> {comment.body}</p>)}{commentCursors[item.id] && <button className="community-secondary" type="button" onClick={() => loadMoreComments(item.id)}>تحميل المزيد من التعليقات</button>}{session ? <><textarea aria-label="تعليق جديد" maxLength={1000} value={commentText[item.id] || ''} onChange={event => setCommentText(value => ({ ...value, [item.id]: event.target.value }))}/><button type="button" disabled={busyActions[`comment:${item.id}`]} className="community-secondary" onClick={() => sendComment(item.id)}>إرسال التعليق للمراجعة</button></> : <p>سجّل الدخول لإضافة تعليق.</p>}</div>}
                </article>;
              }))}
        {view === 'public' && feedState === 'ready' && feedCursor && <button type="button" disabled={busyActions.more} className="community-secondary community-more" onClick={loadMore}>{busyActions.more ? 'جارٍ التحميل…' : 'تحميل المزيد'}</button>}
      </section>
    </section>
  );
}
