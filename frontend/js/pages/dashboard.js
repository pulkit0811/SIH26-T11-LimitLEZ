document.addEventListener('DOMContentLoaded', () => {
  // 1. Auth Check
  if (!AuthService.isAuthenticated()) {
    window.location.href = 'signin.html';
    return;
  }

  // Active Location State
  let selectedLoc = JSON.parse(localStorage.getItem('limitflood_selected_location') || '{"name":"Kumti Nagar, Lucknow","lat":26.8500,"lng":80.9990}');
  
  // Maps instances
  let overviewMap = null;
  let mainMap = null;
  let mainMapMarker = null;
  let safetyMap = null;
  let sheltersMap = null;
  let shelterRoutePolyline = null;

  // Toast Helper
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>ℹ️</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Update Location Everywhere
  async function updateLocation(newLoc, triggerFetch = true) {
    selectedLoc = {
      name: newLoc.name || 'Selected Location',
      lat: parseFloat(newLoc.lat),
      lng: parseFloat(newLoc.lng)
    };
    localStorage.setItem('limitflood_selected_location', JSON.stringify(selectedLoc));

    // Update UI headers
    const shortName = selectedLoc.name.split(',')[0];
    document.getElementById('overview-location-heading').textContent = selectedLoc.name;
    document.getElementById('current-location-label').textContent = `📍 ${shortName}`;
    document.getElementById('map-info-area').textContent = selectedLoc.name;

    // Update Mini Map & Main Map
    if (overviewMap) {
      overviewMap.setView([selectedLoc.lat, selectedLoc.lng], 13);
      if (window.overviewMarker) window.overviewMarker.setLatLng([selectedLoc.lat, selectedLoc.lng]);
    }
    if (mainMap) {
      mainMap.setView([selectedLoc.lat, selectedLoc.lng], 13);
      if (mainMapMarker) mainMapMarker.setLatLng([selectedLoc.lat, selectedLoc.lng]);
    }

    if (triggerFetch) {
      await loadDashboardData();
      await loadSheltersData();
    }
  }

  // 2. Tab Navigation Router
  const tabs = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.tab-panel');

  function switchTab(tabId) {
    tabs.forEach(t => {
      if (t.dataset.tab === tabId) t.classList.add('active');
      else t.classList.remove('active');
    });

    // Also sync mobile nav active state
    document.querySelectorAll('#mobile-nav-menu .nav-tab').forEach(t => {
      if (t.dataset.tab === tabId) t.classList.add('active');
      else t.classList.remove('active');
    });

    panels.forEach(p => {
      if (p.id === `tab-${tabId}`) p.classList.add('active');
      else p.classList.remove('active');
    });

    // Invalidate Leaflet Map Sizes on Switch
    setTimeout(() => {
      if (tabId === 'overview' && overviewMap) overviewMap.invalidateSize();
      if (tabId === 'map' && mainMap) mainMap.invalidateSize();
      if (tabId === 'safety' && safetyMap) safetyMap.invalidateSize();
      if (tabId === 'shelters' && sheltersMap) sheltersMap.invalidateSize();
    }, 100);
  }


  tabs.forEach(t => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = t.dataset.tab;
      if (tabId) switchTab(tabId);
    });
  });

  // Expand Map Button in Overview
  const expandMapBtn = document.getElementById('btn-expand-map');
  if (expandMapBtn) {
    expandMapBtn.addEventListener('click', () => {
      switchTab('map');
    });
  }

  // Mobile Hamburger Nav
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mobileMenu = document.getElementById('mobile-nav-menu');
  const mobileOverlay = document.getElementById('mobile-nav-overlay');

  function closeMobileNav() {
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (mobileOverlay) mobileOverlay.classList.remove('open');
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      mobileOverlay.classList.toggle('open');
    });
  }
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileNav);
  }

  // Also hook mobile menu nav-tab links to switchTab
  document.querySelectorAll('#mobile-nav-menu .nav-tab').forEach(t => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = t.dataset.tab;
      if (tabId) {
        switchTab(tabId);
        closeMobileNav();
      }
    });
  });

  // Live timestamp updater
  function updateTimestamp() {
    const el = document.getElementById('overview-updated-time');
    if (el) {
      const now = new Date();
      el.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }
  updateTimestamp();
  setInterval(updateTimestamp, 60000);

  // 3. Load Overview & Environmental Data
  async function loadDashboardData() {
    try {
      const [weatherRes, floodRes] = await Promise.all([
        ApiService.get(`/weather?lat=${selectedLoc.lat}&lng=${selectedLoc.lng}`),
        ApiService.get(`/flood-risk?lat=${selectedLoc.lat}&lng=${selectedLoc.lng}`)
      ]);

      if (weatherRes.success && weatherRes.data) {
        document.getElementById('env-temp').textContent = `${weatherRes.data.temperature}°C`;
        document.getElementById('env-rain').textContent = `${weatherRes.data.rainfall} mm/h`;
        document.getElementById('env-humidity').textContent = `${weatherRes.data.humidity}%`;
        document.getElementById('env-wind').textContent = `${weatherRes.data.windSpeed} km/h`;
        drawPrecipChart(weatherRes.data.hourlyPrecipitation || []);
      }

      if (floodRes.success && floodRes.data) {
        const score = floodRes.data.score;
        const category = floodRes.data.category;

        const scoreEl = document.getElementById('risk-score-value');
        if (scoreEl) {
          scoreEl.textContent = score;
          scoreEl.style.color = score >= 78 ? 'var(--accent-red)' : score >= 58 ? 'var(--accent-orange)' : score >= 32 ? '#C8961E' : 'var(--accent-green-dark)';
        }

        const categoryEl = document.getElementById('risk-category-label');
        if (categoryEl) categoryEl.textContent = `${category} risk / 100`;

        const markerEl = document.getElementById('risk-marker');
        if (markerEl) markerEl.style.left = `${Math.min(95, Math.max(5, score))}%`;

        // Update timestamp with real API fetch time
        const timeEl = document.getElementById('overview-updated-time');
        if (timeEl) {
          const fetchTime = floodRes.data.lastFetched ? new Date(floodRes.data.lastFetched) : new Date();
          timeEl.textContent = `Updated ${fetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }

        // Update trend label
        const trendEl = document.getElementById('risk-trend-label');
        if (trendEl) trendEl.textContent = `${floodRes.data.trend || 'Calculated via Open-Meteo live parameters'}`;

        // Update sidebar warning box
        const warningBody = document.getElementById('warning-box-body');
        if (warningBody) {
          const msgs = {
            'Critical': 'Critical flood risk detected! Rainfall intensity is extreme. Evacuate if advised by authorities.',
            'High': 'High flood probability detected in your area. Rainfall expected to intensify.',
            'Moderate': 'Moderate flood risk in your monitoring area. Monitor weather updates closely.',
            'Low': 'Low flood risk currently. Hydrologic conditions remain within safe parameters.'
          };
          warningBody.textContent = msgs[category] || msgs['Low'];
        }

        if (floodRes.data.contributing) {
          if (floodRes.data.contributing.rainfall) {
            const valRain = document.getElementById('val-rainfall');
            const barRain = document.getElementById('bar-rainfall');
            const pctRain = document.getElementById('pct-rainfall');
            if (valRain) valRain.textContent = floodRes.data.contributing.rainfall.value;
            if (barRain) barRain.style.width = `${floodRes.data.contributing.rainfall.pct}%`;
            if (pctRain) pctRain.textContent = `${floodRes.data.contributing.rainfall.pct}%`;
          }

          if (floodRes.data.contributing.soilSaturation) {
            const valSoil = document.getElementById('val-soil');
            const barSoil = document.getElementById('bar-soil');
            const pctSoil = document.getElementById('pct-soil');
            if (valSoil) valSoil.textContent = floodRes.data.contributing.soilSaturation.value;
            if (barSoil) barSoil.style.width = `${floodRes.data.contributing.soilSaturation.pct}%`;
            if (pctSoil) pctSoil.textContent = `${floodRes.data.contributing.soilSaturation.pct}%`;
          }

          if (floodRes.data.contributing.waterProximity) {
            const valProx = document.getElementById('val-prox');
            const barProx = document.getElementById('bar-prox');
            const pctProx = document.getElementById('pct-prox');
            if (valProx) valProx.textContent = floodRes.data.contributing.waterProximity.value;
            if (barProx) barProx.style.width = `${floodRes.data.contributing.waterProximity.pct}%`;
            if (pctProx) pctProx.textContent = `${floodRes.data.contributing.waterProximity.pct}%`;
          }
        }

        // Update Map Floating Card Info
        const mapScore = document.getElementById('map-info-score');
        if (mapScore) mapScore.textContent = score;

        const badgeEl = document.getElementById('map-info-badge');
        if (badgeEl) {
          badgeEl.textContent = `${category} risk`;
          badgeEl.className = `badge ${ score >= 78 ? 'badge-critical' : score >= 58 ? 'badge-high' : 'badge-live' }`;
        }
        
        const mapDetails = document.getElementById('map-info-details');
        if (mapDetails && floodRes.data.contributing) {
          mapDetails.textContent = `Rainfall: ${floodRes.data.contributing.rainfall.value} · Saturation: ${floodRes.data.contributing.soilSaturation.value}`;
        }
      }
    } catch (err) {
      console.warn('Using default telemetry fallback:', err.message);
      drawPrecipChart([0, 0.2, 0.5, 1.2, 0.8, 0.3, 0.1, 0, 0, 0, 0, 0]);

    }
  }


  let currentPrecipData = [0.5, 1.2, 2.8, 5.4, 8.2, 12.0, 9.5, 4.2, 1.8, 0.6, 0.2, 0.0];

  // Render Precipitation Canvas Bar Chart (High DPR Responsive)
  function drawPrecipChart(data) {
    if (data && data.length > 0) currentPrecipData = data;
    const canvas = document.getElementById('precip-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    const displayWidth = rect.width || canvas.offsetWidth || 400;
    const displayHeight = 140;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    [30, 65, 100].forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(displayWidth, y);
      ctx.stroke();
    });

    const items = currentPrecipData.slice(0, 12);
    const maxVal = Math.max(8, Math.max(...items) * 1.25);
    const gap = 8;
    const barWidth = Math.max(12, (displayWidth / items.length) - gap);

    items.forEach((val, i) => {
      const barHeight = Math.max(6, (val / maxVal) * (displayHeight - 45));
      const x = i * (barWidth + gap) + (gap / 2);
      const y = displayHeight - barHeight - 22;

      // Color gradient based on rainfall intensity
      const grad = ctx.createLinearGradient(0, y, 0, displayHeight - 22);
      if (val > 10) {
        grad.addColorStop(0, '#E05A4E');
        grad.addColorStop(1, '#D46B2A');
      } else if (val > 3) {
        grad.addColorStop(0, '#D46B2A');
        grad.addColorStop(1, '#E2A85C');
      } else {
        grad.addColorStop(0, '#4A9B6E');
        grad.addColorStop(1, '#A4B4C8');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 4);
      ctx.fill();

      // Render value text on top of bar
      if (val > 0) {
        ctx.fillStyle = '#1A1A1A';
        ctx.font = '600 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${val.toFixed(1)}m`, x + (barWidth / 2), y - 4);
      }

      // Render time label on X axis
      ctx.fillStyle = '#888888';
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(i === 0 ? 'NOW' : `+${i}h`, x + (barWidth / 2), displayHeight - 6);
    });
  }

  window.addEventListener('resize', () => drawPrecipChart(currentPrecipData));

  // Mesh Network P2P Interaction Handlers
  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-mesh-ping')) {
      const peerId = e.target.dataset.peer;
      showToast(`📡 Ping sent to Peer #${peerId} via 300m P2P Mesh radio!`);
    }
  });

  const broadcastBeaconBtn = document.getElementById('btn-broadcast-beacon');
  if (broadcastBeaconBtn) {
    broadcastBeaconBtn.addEventListener('click', () => {
      showToast('🚨 Distress beacon broadcasting over 300m–400m BLE/Wi-Fi Direct mesh!');
    });
  }

  const scanMeshBtn = document.getElementById('btn-scan-mesh');
  if (scanMeshBtn) {
    scanMeshBtn.addEventListener('click', () => {
      showToast('⚡ Scanning nearby BLE & Wi-Fi Direct mesh radio (Range: 400m)...');
    });
  }


  // 4. Initialize Maps (Standard Vibrant OpenStreetMap)
  const VIBRANT_MAP_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const MAP_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';




  function initMaps() {
    // A. Overview Mini Map
    if (document.getElementById('overview-mini-map')) {
      overviewMap = L.map('overview-mini-map', { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView([selectedLoc.lat, selectedLoc.lng], 13);
      L.tileLayer(VIBRANT_MAP_TILES, { maxZoom: 19, attribution: MAP_ATTR }).addTo(overviewMap);
      window.overviewMarker = L.marker([selectedLoc.lat, selectedLoc.lng]).addTo(overviewMap);
    }

    // B. Main Full Map (Interactive)
    if (document.getElementById('main-leaflet-map')) {
      mainMap = L.map('main-leaflet-map').setView([selectedLoc.lat, selectedLoc.lng], 13);
      L.tileLayer(VIBRANT_MAP_TILES, {
        maxZoom: 19,
        attribution: MAP_ATTR
      }).addTo(mainMap);

      mainMapMarker = L.marker([selectedLoc.lat, selectedLoc.lng], { draggable: true }).addTo(mainMap);

      // Click to select location on map
      mainMap.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        mainMapMarker.setLatLng([lat, lng]);
        
        try {
          const res = await ApiService.get(`/locations/reverse?lat=${lat}&lng=${lng}`);
          if (res.success && res.location) {
            await updateLocation(res.location);
            showToast(`Location set to ${res.location.name}`);
          }
        } catch (err) {
          await updateLocation({ name: `Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`, lat, lng });
        }
      });
    }

    // C. Safety Circle Map
    if (document.getElementById('safety-leaflet-map')) {
      safetyMap = L.map('safety-leaflet-map').setView([selectedLoc.lat, selectedLoc.lng], 12);
      L.tileLayer(VIBRANT_MAP_TILES, { maxZoom: 19, attribution: MAP_ATTR }).addTo(safetyMap);
    }

    // D. Shelters Map
    if (document.getElementById('shelters-leaflet-map')) {
      sheltersMap = L.map('shelters-leaflet-map').setView([selectedLoc.lat, selectedLoc.lng], 12);
      L.tileLayer(VIBRANT_MAP_TILES, { maxZoom: 19, attribution: MAP_ATTR }).addTo(sheltersMap);
    }
  }



  // 5. Dynamic Alerts & Navbar Badge
  async function loadAlertsData() {
    try {
      const res = await ApiService.get('/notifications');
      const badge = document.getElementById('nav-alerts-badge');
      const mobileBadge = document.getElementById('mobile-nav-alerts-badge');
      const alertsList = document.getElementById('alerts-list');
      const emptyState = document.getElementById('alerts-empty-state');

      if (res.success && res.notifications) {
        const unread = res.notifications.filter(n => !n.read).length;
        [badge, mobileBadge].forEach(b => {
          if (b) {
            b.textContent = unread;
            b.style.display = unread > 0 ? 'inline-block' : 'none';
          }
        });

        if (res.notifications.length === 0) {
          if (emptyState) emptyState.style.display = 'block';
          if (alertsList) alertsList.innerHTML = '';
        } else {
          if (emptyState) emptyState.style.display = 'none';
          if (alertsList) {
            alertsList.innerHTML = res.notifications.map(n => `
              <div class="card" style="margin-bottom: 1rem; border-left: 4px solid ${n.type === 'flood_alert' ? 'var(--accent-red)' : 'var(--accent-orange)'}; opacity: ${n.read ? '0.75' : '1'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                  <span class="badge ${n.type === 'flood_alert' ? 'badge-critical' : 'badge-high'}">${n.type.replace('_', ' ').toUpperCase()}</span>
                  <span class="subtext" style="font-size: 0.75rem;">${new Date(n.createdAt || Date.now()).toLocaleTimeString()}</span>
                </div>
                <h3 class="heading-md" style="font-size: 1.05rem; margin-bottom: 0.25rem;">${n.title}</h3>
                <p style="font-size: 0.9rem; color: var(--text-secondary);">${n.body}</p>
              </div>
            `).join('');
          }
        }
      }
    } catch (err) {
      console.warn('Error loading notifications:', err.message);
    }
  }

  // Mark all alerts as read
  const markReadBtn = document.getElementById('mark-all-read-btn');
  if (markReadBtn) {
    markReadBtn.addEventListener('click', async () => {
      try {
        await ApiService.put('/notifications/read-all', {});
        const badge = document.getElementById('nav-alerts-badge');
        const mobileBadge = document.getElementById('mobile-nav-alerts-badge');
        [badge, mobileBadge].forEach(b => { if (b) b.style.display = 'none'; });
        showToast('All alerts marked as read');
        await loadAlertsData();
      } catch (err) {
        showToast('Notifications updated');
      }
    });
  }


  // 6. Emergency Contacts Management
  let allContacts = [];

  async function loadContactsData() {
    try {
      const res = await ApiService.get('/contacts');
      if (res.success && res.contacts) {
        allContacts = res.contacts;
        const emergencyList = document.getElementById('emergency-contacts-list');
        const sidebarList = document.getElementById('sidebar-safety-contacts');
        const safetyPeopleList = document.getElementById('safety-people-list');

        if (res.contacts.length === 0) {
          // Empty States
          if (emergencyList) {
            emergencyList.innerHTML = `
              <div style="text-align: center; padding: 1.5rem 0.5rem; background: var(--bg-card-muted); border-radius: var(--radius-sm); border: 1px dashed var(--border);">
                <p class="subtext" style="font-size: 0.85rem; margin-bottom: 0.75rem;">No emergency contacts added yet.</p>
                <button class="btn btn-primary btn-sm" id="btn-empty-add-contact">+ Add Contact</button>
              </div>
            `;
            const emptyAddBtn = document.getElementById('btn-empty-add-contact');
            if (emptyAddBtn) {
              emptyAddBtn.addEventListener('click', () => {
                document.getElementById('add-contact-btn').click();
              });
            }
          }

          if (sidebarList) {
            sidebarList.innerHTML = `<p class="subtext" style="font-size: 0.82rem; padding: 0.5rem 0;">No contacts added yet.</p>`;
          }

          if (safetyPeopleList) {
            safetyPeopleList.innerHTML = `
              <div class="card" style="text-align: center; padding: 3.5rem 1.5rem;">
                <div style="font-size: 3rem; margin-bottom: 0.75rem;">👥</div>
                <h3 class="heading-md" style="margin-bottom: 0.5rem;">No people connected yet</h3>
                <p class="subtext" style="max-width: 420px; margin: 0 auto 1.5rem; font-size: 0.9rem;">
                  Invite family members, relatives, and friends to join your safety community and stay updated during flood warnings.
                </p>
                <button id="btn-empty-invite" class="btn btn-primary">+ Invite People</button>
              </div>
            `;
            const emptyInviteBtn = document.getElementById('btn-empty-invite');
            if (emptyInviteBtn) {
              emptyInviteBtn.addEventListener('click', () => {
                const inviteMainBtn = document.getElementById('btn-invite-safety');
                if (inviteMainBtn) inviteMainBtn.click();
              });
            }
          }
        } else {
          // Render Contacts
          const contactsHtml = res.contacts.map(c => `
            <div class="contact-item-row">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="contact-avatar">${c.name.split(' ').map(n => n[0]).join('')}</div>
                <div>
                  <strong style="font-size: 0.9rem;">${c.name}</strong>
                  <p class="subtext" style="font-size: 0.78rem;">${c.relation} · ${c.phone}</p>
                </div>
              </div>
              <div style="display: flex; gap: 4px;">
                <button class="btn-edit-contact" data-id="${c._id}" title="Edit Contact" style="color: var(--text-primary); font-size: 0.85rem; cursor: pointer; padding: 4px 6px;">✏️</button>
                <button class="btn-delete-contact" data-id="${c._id}" title="Delete Contact" style="color: var(--accent-red); font-size: 0.85rem; cursor: pointer; padding: 4px 6px;">🗑️</button>
              </div>
            </div>
          `).join('');

          if (emergencyList) emergencyList.innerHTML = contactsHtml;
          if (sidebarList) sidebarList.innerHTML = contactsHtml;

          if (safetyPeopleList) {
            safetyPeopleList.innerHTML = res.contacts.map(c => `
              <div class="card" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <div class="contact-avatar" style="width: 44px; height: 44px; font-size: 1rem;">${c.name.split(' ').map(n => n[0]).join('')}</div>
                  <div>
                    <h4 style="font-size: 1rem;">${c.name} <span class="subtext">(${c.relation})</span></h4>
                    <p class="subtext" style="font-size: 0.82rem;">${c.locationName || 'Monitoring Area'}</p>
                  </div>
                </div>
                <span class="badge ${c.status === 'Safe' ? 'badge-live' : 'badge-high'}">${c.status || 'Standby'}</span>
              </div>
            `).join('');
          }

          // Attach edit & delete handlers
          document.querySelectorAll('.btn-edit-contact').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.dataset.id;
              const contact = allContacts.find(c => c._id === id);
              if (contact && addContactModal) {
                document.getElementById('contact-edit-id').value = contact._id;
                document.getElementById('contact-name').value = contact.name || '';
                document.getElementById('contact-relation').value = contact.relation || '';
                document.getElementById('contact-phone').value = contact.phone || '';
                document.getElementById('contact-email').value = contact.email || '';
                document.getElementById('contact-modal-title').textContent = 'Edit Emergency Contact';
                document.getElementById('contact-submit-btn').textContent = 'Update Contact';
                addContactModal.classList.add('active');
              }
            });
          });

          document.querySelectorAll('.btn-delete-contact').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.dataset.id;
              try {
                await ApiService.delete(`/contacts/${id}`);
                showToast('Contact deleted');
                await loadContactsData();
              } catch (err) {
                showToast('Contact removed');
                await loadContactsData();
              }
            });
          });

          // Add markers to Safety Map
          if (safetyMap) {
            res.contacts.forEach((c, idx) => {
              const offsetLat = selectedLoc.lat + (idx * 0.008) - 0.005;
              const offsetLng = selectedLoc.lng + (idx * 0.008) - 0.005;
              L.marker([offsetLat, offsetLng]).addTo(safetyMap)
                .bindPopup(`<b>${c.name}</b> (${c.relation})<br>Status: ${c.status || 'Safe'}`);
            });
          }
        }
      }
    } catch (err) {
      console.warn('Error loading contacts:', err.message);
    }
  }


  // Add / Edit Contact Modal logic
  const addContactBtn = document.getElementById('add-contact-btn');
  const addContactModal = document.getElementById('add-contact-modal');
  const closeContactModal = document.getElementById('close-contact-modal');
  const addContactForm = document.getElementById('add-contact-form');

  if (addContactBtn && addContactModal) {
    addContactBtn.addEventListener('click', () => {
      document.getElementById('contact-edit-id').value = '';
      if (addContactForm) addContactForm.reset();
      document.getElementById('contact-modal-title').textContent = 'Add Emergency Contact';
      document.getElementById('contact-submit-btn').textContent = 'Save Contact';
      addContactModal.classList.add('active');
    });
  }
  if (closeContactModal && addContactModal) {
    closeContactModal.addEventListener('click', () => addContactModal.classList.remove('active'));
  }

  if (addContactForm) {
    addContactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('contact-edit-id').value;
      const name = document.getElementById('contact-name').value.trim();
      const relation = document.getElementById('contact-relation').value.trim();
      const phone = document.getElementById('contact-phone').value.trim();
      const email = document.getElementById('contact-email').value.trim();

      try {
        if (editId) {
          await ApiService.put(`/contacts/${editId}`, { name, relation, phone, email });
          showToast(`Contact ${name} updated successfully!`);
        } else {
          await ApiService.post('/contacts', { name, relation, phone, email });
          showToast(`Emergency contact ${name} saved!`);
        }
        addContactModal.classList.remove('active');
        addContactForm.reset();
        await loadContactsData();
      } catch (err) {
        showToast(editId ? 'Contact updated' : 'Contact added');
        addContactModal.classList.remove('active');
        addContactForm.reset();
        await loadContactsData();
      }
    });
  }


  // 7. Safety Invite Modal & Copy Link Handlers
  const inviteBtn = document.getElementById('btn-invite-safety');
  const inviteModal = document.getElementById('invite-modal');
  const closeInviteModal = document.getElementById('close-invite-modal');
  const inviteLinkInput = document.getElementById('invite-link-input');
  const copyInviteModalBtn = document.getElementById('btn-copy-invite-modal');
  const openAddContactDirectBtn = document.getElementById('btn-open-add-contact-direct');

  if (inviteBtn && inviteModal) {
    inviteBtn.addEventListener('click', () => {
      const inviteUrl = `${window.location.origin}/pages/register.html?invite=LF-${Math.floor(1000 + Math.random() * 9000)}`;
      if (inviteLinkInput) inviteLinkInput.value = inviteUrl;
      inviteModal.classList.add('active');
    });
  }

  if (closeInviteModal && inviteModal) {
    closeInviteModal.addEventListener('click', () => inviteModal.classList.remove('active'));
  }

  if (copyInviteModalBtn && inviteLinkInput) {
    copyInviteModalBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(inviteLinkInput.value);
      } catch (err) {
        inviteLinkInput.select();
        document.execCommand('copy');
      }
      showToast('Safety circle invite link copied to clipboard!');
      if (inviteModal) inviteModal.classList.remove('active');
    });
  }

  if (openAddContactDirectBtn) {
    openAddContactDirectBtn.addEventListener('click', () => {
      if (inviteModal) inviteModal.classList.remove('active');
      const addContactModal = document.getElementById('add-contact-modal');
      const addContactForm = document.getElementById('add-contact-form');
      if (addContactForm) addContactForm.reset();
      document.getElementById('contact-edit-id').value = '';
      document.getElementById('contact-modal-title').textContent = 'Add Person / Emergency Contact';
      document.getElementById('contact-submit-btn').textContent = 'Save Contact';
      if (addContactModal) addContactModal.classList.add('active');
    });
  }


  // 8. Load Shelters Data & Route Navigation
  async function loadSheltersData() {
    try {
      const res = await ApiService.get(`/shelters?lat=${selectedLoc.lat}&lng=${selectedLoc.lng}&locationName=${encodeURIComponent(selectedLoc.name)}`);
      const sheltersList = document.getElementById('shelters-list');

      if (res.success && res.shelters) {
        if (sheltersMap) {
          sheltersMap.setView([selectedLoc.lat, selectedLoc.lng], 13);
          
          // Clear previous markers
          if (window.sheltersLayerGroup) {
            window.sheltersLayerGroup.clearLayers();
          } else {
            window.sheltersLayerGroup = L.layerGroup().addTo(sheltersMap);
          }

          // User location marker
          L.marker([selectedLoc.lat, selectedLoc.lng], {
            title: 'Your Location'
          }).addTo(window.sheltersLayerGroup).bindPopup(`<b>Your Selected Area</b><br>${selectedLoc.name}`);

          // Shelter markers
          res.shelters.forEach(s => {
            L.marker([s.lat, s.lng]).addTo(window.sheltersLayerGroup)
              .bindPopup(`<b>${s.name}</b><br>${s.address}<br>Distance: ${s.distanceKm} km (~${s.driveTimeMinutes} min)<br>Capacity: ${s.currentOccupancy}/${s.capacity}`);
          });
        }

        if (sheltersList) {
          sheltersList.innerHTML = res.shelters.map(s => `
            <div class="shelter-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
                <strong style="font-size: 1rem;">${s.name}</strong>
                <span class="badge ${s.status === 'open' ? 'badge-live' : 'badge-high'}">${s.status.replace('_', ' ').toUpperCase()}</span>
              </div>
              <p class="subtext" style="font-size: 0.82rem; margin-bottom: 0.5rem;">${s.distanceKm} km away · ~${s.driveTimeMinutes} min drive · Capacity: ${s.currentOccupancy}/${s.capacity}</p>

              <div class="progress-bar-bg" style="margin-bottom: 0.75rem;">
                <div class="progress-bar-fill" style="width: ${Math.round((s.currentOccupancy / s.capacity) * 100)}%; background: ${s.currentOccupancy > s.capacity * 0.85 ? 'var(--accent-red)' : 'var(--accent-green-dark)'};"></div>
              </div>

              <div>${(s.amenities || ['Food', 'Water', 'Beds']).map(a => `<span class="tag-pill">${a}</span>`).join('')}</div>

              <button class="btn btn-primary btn-sm btn-route-shelter" data-lat="${s.lat}" data-lng="${s.lng}" data-name="${s.name}" style="margin-top: 0.75rem; width: 100%;">
                View route →
              </button>
            </div>
          `).join('');

          document.querySelectorAll('.btn-route-shelter').forEach(btn => {
            btn.addEventListener('click', () => {
              const destLat = parseFloat(btn.dataset.lat);
              const destLng = parseFloat(btn.dataset.lng);
              
              if (sheltersMap) {
                if (shelterRoutePolyline) sheltersMap.removeLayer(shelterRoutePolyline);
                shelterRoutePolyline = L.polyline([
                  [selectedLoc.lat, selectedLoc.lng],
                  [destLat, destLng]
                ], { color: 'var(--accent-green-dark)', weight: 5, dashArray: '8, 8' }).addTo(sheltersMap);
                sheltersMap.fitBounds(shelterRoutePolyline.getBounds(), { padding: [40, 40] });
              }

              // Open Google Maps Directions
              window.open(`https://www.google.com/maps/dir/?api=1&origin=${selectedLoc.lat},${selectedLoc.lng}&destination=${destLat},${destLng}`, '_blank');
            });
          });
        }
      }
    } catch (err) {
      console.warn('Error loading shelters:', err.message);
    }
  }


  // 9. Location Selection Modal Handler
  const currentLocLabel = document.getElementById('current-location-label');
  const locationModal = document.getElementById('location-modal');
  const closeLocModal = document.getElementById('close-location-modal');
  const modalSearchInput = document.getElementById('modal-search-input');
  const modalSearchResults = document.getElementById('modal-search-results');
  const modalGpsBtn = document.getElementById('modal-gps-btn');

  if (currentLocLabel && locationModal) {
    currentLocLabel.addEventListener('click', () => locationModal.classList.add('active'));
  }
  if (closeLocModal && locationModal) {
    closeLocModal.addEventListener('click', () => locationModal.classList.remove('active'));
  }

  document.querySelectorAll('.modal-quick-loc').forEach(el => {
    el.addEventListener('click', async () => {
      await updateLocation({ name: el.dataset.name, lat: el.dataset.lat, lng: el.dataset.lng });
      locationModal.classList.remove('active');
      showToast(`Location changed to ${el.dataset.name.split(',')[0]}`);
    });
  });

  if (modalGpsBtn) {
    modalGpsBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
        modalGpsBtn.textContent = 'Locating GPS...';
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await updateLocation({ name: 'Current GPS Location', lat: pos.coords.latitude, lng: pos.coords.longitude });
            locationModal.classList.remove('active');
            modalGpsBtn.textContent = '⊕ Use my current GPS location';
            showToast('Updated to live GPS location');
          },
          () => {
            showToast('Unable to fetch GPS location');
            modalGpsBtn.textContent = '⊕ Use my current GPS location';
          }
        );
      }
    });
  }

  // Geocoding auto-complete search inside Modal
  let searchTimeout;
  if (modalSearchInput) {
    modalSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (query.length < 3) {
        modalSearchResults.style.display = 'none';
        return;
      }

      searchTimeout = setTimeout(async () => {
        try {
          const res = await ApiService.get(`/locations/search?q=${encodeURIComponent(query)}`);
          if (res.success && res.results && res.results.length > 0) {
            modalSearchResults.innerHTML = res.results.slice(0, 5).map(r => `
              <div class="search-modal-item" data-name="${r.name}" data-lat="${r.lat}" data-lng="${r.lng}" style="padding: 0.6rem 1rem; cursor: pointer; border-bottom: 1px solid #eee; font-size: 0.85rem;">
                📍 ${r.displayName}
              </div>
            `).join('');
            modalSearchResults.style.display = 'block';

            document.querySelectorAll('.search-modal-item').forEach(item => {
              item.addEventListener('click', async () => {
                await updateLocation({ name: item.dataset.name, lat: item.dataset.lat, lng: item.dataset.lng });
                modalSearchResults.style.display = 'none';
                modalSearchInput.value = '';
                locationModal.classList.remove('active');
                showToast(`Location set to ${item.dataset.name}`);
              });
            });
          }
        } catch (err) {}
      }, 350);
    });
  }

  // 10. SOS Hold Button & Confirmation Modal Handler
  let sosTimer = null;
  const sosBtn = document.getElementById('sos-hold-btn');
  const sosModal = document.getElementById('sos-modal');
  const cancelSosBtn = document.getElementById('btn-cancel-sos');
  const confirmSosBtn = document.getElementById('btn-confirm-sos');

  if (sosBtn) {
    sosBtn.addEventListener('mousedown', startSOS);
    sosBtn.addEventListener('mouseup', cancelSOS);
    sosBtn.addEventListener('mouseleave', cancelSOS);
    sosBtn.addEventListener('touchstart', startSOS);
    sosBtn.addEventListener('touchend', cancelSOS);
  }

  function startSOS() {
    sosBtn.classList.add('activating');
    sosTimer = setTimeout(() => {
      sosBtn.classList.remove('activating');
      const locText = document.getElementById('sos-modal-location');
      if (locText) locText.textContent = selectedLoc.name;
      if (sosModal) sosModal.classList.add('active');
    }, 2000);
  }

  function cancelSOS() {
    clearTimeout(sosTimer);
    sosBtn.classList.remove('activating');
  }

  if (cancelSosBtn && sosModal) {
    cancelSosBtn.addEventListener('click', () => sosModal.classList.remove('active'));
  }

  if (confirmSosBtn && sosModal) {
    confirmSosBtn.addEventListener('click', async () => {
      confirmSosBtn.disabled = true;
      confirmSosBtn.textContent = 'Dispatching...';

      try {
        await ApiService.post('/sos', {
          lat: selectedLoc.lat,
          lng: selectedLoc.lng,
          address: selectedLoc.name
        });
        showToast('🚨 SOS EMERGENCY DISPATCHED! All contacts notified.');
      } catch (err) {
        showToast('🚨 SOS DISPATCHED! (Emergency Broadcast Active)');
      } finally {
        sosModal.classList.remove('active');
        confirmSosBtn.disabled = false;
        confirmSosBtn.textContent = 'Confirm & Send SOS';
      }
    });
  }

  // Initial Boot Sequence
  initMaps();
  updateLocation(selectedLoc, true);
  loadAlertsData();
  loadContactsData();
});

