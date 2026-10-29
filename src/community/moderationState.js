export function applyModerationDecision(state, targetType, id, status) {
  const collection = targetType === 'comment' ? 'comments' : 'posts';
  return {
    ...state,
    [collection]: (state[collection] || []).map(item => item.id === id ? { ...item, status } : item),
    ...(targetType === 'post' && status !== 'approved'
      ? { publicPosts: (state.publicPosts || []).filter(post => post.id !== id) }
      : {}),
  };
}
