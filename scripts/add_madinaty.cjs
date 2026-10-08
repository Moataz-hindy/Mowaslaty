const fs = require('fs');
const path = require('path');

async function main() {
  console.log('--- Starting Madinaty Routes Generator ---');

  const routesPath = path.join(__dirname, '..', 'data', 'routes_summary.json');
  const geomPath = path.join(__dirname, '..', 'data', 'routes_geometry.json');
  const stopsPath = path.join(__dirname, '..', 'data', 'stops_summary.json');

  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  const geom = JSON.parse(fs.readFileSync(geomPath, 'utf8'));
  const stops = JSON.parse(fs.readFileSync(stopsPath, 'utf8'));

  // Calculate starting fid
  let maxFid = 0;
  routes.forEach(r => {
    if (r.fid && r.fid > maxFid) maxFid = r.fid;
  });

  const linesConfig = [
    {
      idPrefix: 'MBS_SQ',
      num: 'M-SQ',
      short_ar: 'باص مدينتي (سراي القبة)',
      short_en: 'Madinaty - Saray El-Qobba',
      long_ar: 'مدينتي (الساوث بارك) - محطة مترو سراي القبة',
      long_en: 'Madinaty (South Park) - Saray El-Qobba Metro',
      origin_ar: 'مدينتي (الساوث بارك)',
      origin_en: 'Madinaty (South Park)',
      dest_ar: 'محطة مترو سراي القبة',
      dest_en: 'Saray El-Qobba Metro',
      fare: 25,
      capacity: 35,
      color: '#0284c7',
      outboundWaypoints: '31.6315,30.0890;31.6273,30.1078;31.6210,30.1340;31.4350,30.0930;31.3540,30.0862;31.3320,30.0895;31.3200,30.0915;31.3015,30.0988',
      inboundWaypoints: '31.3015,30.0988;31.3200,30.0915;31.3320,30.0895;31.3540,30.0862;31.4350,30.0930;31.6210,30.1340;31.6273,30.1078;31.6315,30.0890',
      via_stops: [
        'مدينتي (الساوث بارك)',
        'أوبن إير مول مدينتي',
        'بوابة مدينتي (طريق السويس)',
        'طريق السويس - كوبري الدائري',
        'طريق الثورة - مستشفى الكهرباء',
        'ألماظة (كوبري المشير)',
        'سنترال ألماظة (الميرغني)',
        'مترو الأهرام (مصر الجديدة)',
        'الكوربة',
        'مستشفى الجنزوري',
        'سنترال سراي القبة',
        'محطة مترو سراي القبة'
      ],
      via_stops_en: [
        'Madinaty (South Park)',
        'Open Air Mall Madinaty',
        'Madinaty Suez Rd Gate',
        'Suez Rd - Ring Rd',
        'El-Thawra - Electricity Hospital',
        'Almaza (El-Mosheer Bridge)',
        'Almaza Central (El-Merghany)',
        'Al-Ahram Metro (Heliopolis)',
        'Korba',
        'El-Ganzoury Hospital',
        'Saray El-Qobba Central',
        'Saray El-Qobba Metro Station'
      ],
      sub_districts: ['Madinaty', 'Suez Road', 'Heliopolis', 'Al-Zaitoun']
    },
    {
      idPrefix: 'MBS_NC',
      num: 'M-NC',
      short_ar: 'باص مدينتي (مدينة نصر)',
      short_en: 'Madinaty - Nasr City',
      long_ar: 'مدينتي (الساوث بارك) - ميدان الساعة (مكرم عبيد)',
      long_en: "Madinaty (South Park) - Sa'a Sq (Makram Ebeid)",
      origin_ar: 'مدينتي (الساوث بارك)',
      origin_en: 'Madinaty (South Park)',
      dest_ar: 'ميدان الساعة (مدينة نصر)',
      dest_en: "Sa'a Square (Nasr City)",
      fare: 25,
      capacity: 35,
      color: '#0ea5e9',
      outboundWaypoints: '31.6315,30.0890;31.6273,30.1078;31.6210,30.1340;31.4350,30.0930;31.3540,30.0862;31.3458,30.0731;31.3410,30.0635;31.3340,30.0660',
      inboundWaypoints: '31.3340,30.0660;31.3410,30.0635;31.3458,30.0731;31.3540,30.0862;31.4350,30.0930;31.6210,30.1340;31.6273,30.1078;31.6315,30.0890',
      via_stops: [
        'مدينتي (الساوث بارك)',
        'أوبن إير مول مدينتي',
        'بوابة مدينتي (طريق السويس)',
        'طريق السويس - كوبري الدائري',
        'طريق الثورة - ألماظة',
        'سيتي ستارز',
        'النادي الأهلي (مدينة نصر)',
        'أول مكرم عبيد',
        'ميدان الساعة (عباس العقاد)'
      ],
      via_stops_en: [
        'Madinaty (South Park)',
        'Open Air Mall Madinaty',
        'Madinaty Suez Rd Gate',
        'Suez Rd - Ring Rd',
        'El-Thawra - Almaza',
        'City Stars',
        'Al-Ahly Club (Nasr City)',
        'Makram Ebeid',
        "Sa'a Sq (Abbas El Akkad)"
      ],
      sub_districts: ['Madinaty', 'Suez Road', 'Nasr City', 'Almaza']
    },
    {
      idPrefix: 'MBS_5S',
      num: 'M-5S',
      short_ar: 'باص مدينتي (التجمع الخامس)',
      short_en: 'Madinaty - 5th Settlement',
      long_ar: 'مدينتي (الساوث بارك) - مول الداون تاون (التجمع الخامس)',
      long_en: 'Madinaty (South Park) - Downtown Mall (5th Settlement)',
      origin_ar: 'مدينتي (الساوث بارك)',
      origin_en: 'Madinaty (South Park)',
      dest_ar: 'مول داون تاون (التجمع الخامس)',
      dest_en: 'Downtown Mall (5th Settlement)',
      fare: 20,
      capacity: 35,
      color: '#38bdf8',
      outboundWaypoints: '31.6315,30.0890;31.6273,30.1078;31.6210,30.1340;31.5200,30.0750;31.5050,30.0650;31.4880,30.0380;31.4720,30.0290;31.4550,30.0260;31.4420,30.0220;31.4280,30.0165;31.4080,30.0175',
      inboundWaypoints: '31.4080,30.0175;31.4280,30.0165;31.4420,30.0220;31.4550,30.0260;31.4720,30.0290;31.4880,30.0380;31.5050,30.0650;31.5200,30.0750;31.6210,30.1340;31.6273,30.1078;31.6315,30.0890',
      via_stops: [
        'مدينتي (الساوث بارك)',
        'أوبن إير مول مدينتي',
        'بوابة مدينتي (طريق السويس)',
        'بوابات الرحاب (طريق السويس)',
        'مكسيم مول (التسعين الشمالي)',
        'جامعة المستقبل (FUE)',
        'لولو هايبرماركت / أمريكان بلازا',
        'فندق دوسيت تاني',
        'المستشفى الجوي التخصصي',
        'مجمع البنوك (التسعين الجنوبي)',
        'محطة الغاز',
        'مول داون تاون (التجمع الخامس)'
      ],
      via_stops_en: [
        'Madinaty (South Park)',
        'Open Air Mall Madinaty',
        'Madinaty Suez Rd Gate',
        'Rehab Gates (Suez Rd)',
        'Maxim Mall (North 90th)',
        'Future University (FUE)',
        'Lulu / American Plaza',
        'Dusit Thani Hotel',
        'Air Specialized Hospital',
        'Banks Complex (South 90th)',
        'Gas Station',
        'Downtown Mall (5th Settlement)'
      ],
      sub_districts: ['Madinaty', 'Suez Road', 'Rehab', 'New Cairo', '5th Settlement']
    },
    {
      idPrefix: 'MBS_RH',
      num: 'M-RH',
      short_ar: 'باص مدينتي (الرحاب)',
      short_en: 'Madinaty - Rehab Direct',
      long_ar: 'مدينتي (الساوث بارك) - الرحاب (بوابة 20)',
      long_en: 'Madinaty (South Park) - Rehab (Gate 20)',
      origin_ar: 'مدينتي (الساوث بارك)',
      origin_en: 'Madinaty (South Park)',
      dest_ar: 'الرحاب (بوابة 20)',
      dest_en: 'Al Rehab (Gate 20)',
      fare: 15,
      capacity: 35,
      color: '#06b6d4',
      outboundWaypoints: '31.6315,30.0890;31.6273,30.1078;31.6210,30.1340;31.5150,30.0750;31.4920,30.0630',
      inboundWaypoints: '31.4920,30.0630;31.5150,30.0750;31.6210,30.1340;31.6273,30.1078;31.6315,30.0890',
      via_stops: [
        'مدينتي (الساوث بارك)',
        'أوبن إير مول مدينتي',
        'بوابة مدينتي (طريق السويس)',
        'محور السادات',
        'الرحاب (بوابة 20)'
      ],
      via_stops_en: [
        'Madinaty (South Park)',
        'Open Air Mall Madinaty',
        'Madinaty Suez Rd Gate',
        'Sadat Axis',
        'Al Rehab (Gate 20)'
      ],
      sub_districts: ['Madinaty', 'Suez Road', 'Rehab']
    }
  ];

  // Helper to fetch OSRM coordinates
  async function fetchOSRM(waypointString) {
    const url = `https://router.project-osrm.org/route/v1/driving/${waypointString}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM fetch failed: ${res.status}`);
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) throw new Error('No route found in OSRM response');
    const coords = data.routes[0].geometry.coordinates.map(pt => [
      Number(pt[1].toFixed(5)), // lat
      Number(pt[0].toFixed(5))  // lng
    ]);
    const distKm = Number((data.routes[0].distance / 1000).toFixed(1));
    return { coords, distKm };
  }

  // Remove existing Madinaty lines if running idempotently
  const filteredRoutes = routes.filter(r => !r.id.startsWith('MBS_'));

  for (const cfg of linesConfig) {
    console.log(`Fetching route: ${cfg.short_en}...`);

    // 1. Outbound (dir 0)
    const outRes = await fetchOSRM(cfg.outboundWaypoints);
    const outId = `${cfg.idPrefix}_O`;
    maxFid++;

    // Compute bounding box
    let minLat = 999, maxLat = -999, minLng = 999, maxLng = -999;
    outRes.coords.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    const outRoute = {
      id: outId,
      fid: maxFid,
      route_id: cfg.idPrefix,
      num: cfg.num,
      short_en: cfg.short_en,
      short_ar: cfg.short_ar,
      long_en: cfg.long_en,
      long_ar: cfg.long_ar,
      vehicle: 'Bus',
      agency: 'Madinaty',
      dir: 0,
      origin: cfg.origin_ar,
      dest: cfg.dest_ar,
      origin_en: cfg.origin_en,
      dest_en: cfg.dest_en,
      len_km: outRes.distKm,
      fare: cfg.fare,
      capacity: cfg.capacity,
      color: cfg.color,
      bounds: [[minLat, minLng], [maxLat, maxLng]],
      start_pt: outRes.coords[0],
      end_pt: outRes.coords[outRes.coords.length - 1],
      points_count: outRes.coords.length,
      sub_districts: cfg.sub_districts,
      via_stops: cfg.via_stops,
      via_stops_en: cfg.via_stops_en
    };

    filteredRoutes.push(outRoute);
    geom[outId] = outRes.coords;

    // 2. Inbound (dir 1)
    const inRes = await fetchOSRM(cfg.inboundWaypoints);
    const inId = `${cfg.idPrefix}_R`;
    maxFid++;

    let inMinLat = 999, inMaxLat = -999, inMinLng = 999, inMaxLng = -999;
    inRes.coords.forEach(([lat, lng]) => {
      if (lat < inMinLat) inMinLat = lat;
      if (lat > inMaxLat) inMaxLat = lat;
      if (lng < inMinLng) minLng = lng;
      if (lng > inMaxLng) maxLng = lng;
    });

    const inRoute = {
      id: inId,
      fid: maxFid,
      route_id: cfg.idPrefix,
      num: cfg.num,
      short_en: cfg.short_en,
      short_ar: cfg.short_ar,
      long_en: `${cfg.dest_en} - ${cfg.origin_en}`,
      long_ar: `${cfg.dest_ar} - ${cfg.origin_ar}`,
      vehicle: 'Bus',
      agency: 'Madinaty',
      dir: 1,
      origin: cfg.dest_ar,
      dest: cfg.origin_ar,
      origin_en: cfg.dest_en,
      dest_en: cfg.origin_en,
      len_km: inRes.distKm,
      fare: cfg.fare,
      capacity: cfg.capacity,
      color: cfg.color,
      bounds: [[inMinLat, inMinLng], [inMaxLat, inMaxLng]],
      start_pt: inRes.coords[0],
      end_pt: inRes.coords[inRes.coords.length - 1],
      points_count: inRes.coords.length,
      sub_districts: cfg.sub_districts,
      via_stops: [...cfg.via_stops].reverse(),
      via_stops_en: [...cfg.via_stops_en].reverse()
    };

    filteredRoutes.push(inRoute);
    geom[inId] = inRes.coords;
  }

  // Add Madinaty official bus stops into stops_summary
  const newStops = [
    {
      id: 4001,
      name_en: 'Madinaty - South Park (Movement Area)',
      name_ar: 'مدينتي - ساوث بارك (منطقة الحركة)',
      lat: 30.0890,
      lng: 31.6315
    },
    {
      id: 4002,
      name_en: 'Madinaty - Open Air Mall',
      name_ar: 'مدينتي - أوبن إير مول',
      lat: 30.1078,
      lng: 31.6273
    },
    {
      id: 4003,
      name_en: 'Madinaty - Suez Road Gate',
      name_ar: 'مدينتي - بوابة طريق السويس',
      lat: 30.1340,
      lng: 31.6210
    },
    {
      id: 4004,
      name_en: 'Al Rehab - Gate 20',
      name_ar: 'الرحاب - بوابة 20',
      lat: 30.0630,
      lng: 31.4920
    },
    {
      id: 4005,
      name_en: 'Al Rehab - Suez Road Gates',
      name_ar: 'الرحاب - بوابات طريق السويس',
      lat: 30.0650,
      lng: 31.5050
    },
    {
      id: 4006,
      name_en: 'Maxim Mall (North 90th St)',
      name_ar: 'مكسيم مول (التسعين الشمالي)',
      lat: 30.0380,
      lng: 31.4880
    },
    {
      id: 4007,
      name_en: 'Dusit Thani Hotel (South 90th St)',
      name_ar: 'فندق دوسيت (التسعين الجنوبي)',
      lat: 30.0260,
      lng: 31.4550
    },
    {
      id: 4008,
      name_en: 'Downtown Mall (New Cairo)',
      name_ar: 'مول داون تاون (التجمع الخامس)',
      lat: 30.0175,
      lng: 31.4080
    },
    {
      id: 4009,
      name_en: "Al-Sa'a Sq. (Makram Ebeid)",
      name_ar: 'ميدان الساعة (مكرم عبيد / عباس العقاد)',
      lat: 30.0660,
      lng: 31.3340
    },
    {
      id: 4010,
      name_en: 'Saray El-Qobba Metro (Madinaty Bus Stop)',
      name_ar: 'محطة مترو سراي القبة (موقف باص مدينتي)',
      lat: 30.0988,
      lng: 31.3015
    }
  ];

  const filteredStops = stops.filter(s => !(s.id >= 4001 && s.id <= 4010));
  filteredStops.push(...newStops);

  console.log(`Saving ${filteredRoutes.length} routes...`);
  fs.writeFileSync(routesPath, JSON.stringify(filteredRoutes), 'utf8');

  console.log(`Saving ${Object.keys(geom).length} geometries...`);
  fs.writeFileSync(geomPath, JSON.stringify(geom), 'utf8');

  console.log(`Saving ${filteredStops.length} stops...`);
  fs.writeFileSync(stopsPath, JSON.stringify(filteredStops, null, 2), 'utf8');

  console.log('✅ Successfully added Madinaty bus routes, geometries, and stops!');
}

main().catch(err => {
  console.error('Error generating Madinaty routes:', err);
  process.exit(1);
});
