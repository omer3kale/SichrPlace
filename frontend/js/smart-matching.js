(function (window) {
  const API_ROOT = '/api/matching';

  const getToken = () => {
    return (
      window.localStorage?.getItem('token') ||
      window.sessionStorage?.getItem('token') ||
      null
    );
  };

  const sanitiseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const sanitiseBoolean = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    const normalised = value.toString().trim().toLowerCase();
    if (normalised === 'true' || normalised === '1' || normalised === 'yes') return true;
    if (normalised === 'false' || normalised === '0' || normalised === 'no') return false;
    return null;
  };

  const splitInputList = (value) => {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const toFormListValue = (value) => {
    if (!value) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (value instanceof Set) return Array.from(value).join(', ');
    return value.toString();
  };

  const parseErrorMessage = (error, fallback) => {
    if (!error) return fallback;
    if (typeof error === 'object' && error.status === 401) {
      return 'Bitte melden Sie sich an, um Smart Matching zu nutzen.';
    }
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.error) return error.error;
    if (error.statusText) return error.statusText;
    return fallback;
  };

  const fetchJson = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_ROOT}${path}`, {
      credentials: 'include',
      ...options,
      headers
    });

    const rawText = await response.text();
    let parsed;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch (err) {
      parsed = rawText;
    }

    if (!response.ok) {
      const errorMessage = parsed?.error || parsed?.message || response.statusText;
      const error = new Error(errorMessage || 'Something went wrong');
      error.status = response.status;
      error.details = parsed;
      throw error;
    }

    return parsed;
  };

  const renderAlert = (selector, type, message) => {
    if (!selector) return;
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    if (!message) {
      el.innerHTML = '';
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.innerHTML = `
      <div class="smart-matching-alert-message smart-matching-alert-${type}">
        <span>${message}</span>
      </div>
    `;
  };

  const createEmptyState = (message) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'smart-matching-empty';
    wrapper.innerHTML = `
      <div class="smart-matching-empty-icon">✨</div>
      <p>${message}</p>
    `;
    return wrapper;
  };

  const buildMatchCard = (match) => {
    const card = document.createElement('article');
    card.className = 'smart-match-card';

    if (!match || !match.apartment) {
      card.innerHTML = '<p>No data available.</p>';
      return card;
    }

    const apartment = match.apartment;
    const score = Math.round(match.score ?? 0);

    const amenities = Array.isArray(match.matchedAmenities) && match.matchedAmenities.length > 0
      ? `<div class="smart-match-amenities"><strong>Ausstattung:</strong> ${match.matchedAmenities.join(', ')}</div>`
      : '';

    const insights = Array.isArray(match.insights) && match.insights.length > 0
      ? `<ul class="smart-match-insights">${match.insights.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '';

    const distance = match.distanceKm !== null && match.distanceKm !== undefined
      ? `<div class="smart-match-distance">Entfernung: ${match.distanceKm} km</div>`
      : '';

    card.innerHTML = `
      <header class="smart-match-card-header">
        <div>
          <h4>${apartment.title || 'Unbekanntes Angebot'}</h4>
          <div class="smart-match-score" aria-label="Match Score">
            <span>${score}</span>
            <small>Score</small>
          </div>
        </div>
        <p class="smart-match-location">${[apartment.city, apartment.postal_code].filter(Boolean).join(' • ')}</p>
      </header>
      <div class="smart-match-body">
        <div class="smart-match-price">${apartment.price ? `€${apartment.price.toLocaleString('de-DE')}` : 'Preis auf Anfrage'}</div>
        <div class="smart-match-details">
          <span>${apartment.rooms ? `${apartment.rooms} Zimmer` : 'Zimmer unbekannt'}</span>
          <span>${apartment.size ? `${apartment.size} m²` : 'Größe k.A.'}</span>
          <span>${apartment.furnished ? 'Möbliert' : 'Unmöbliert'}</span>
        </div>
        ${distance}
        ${amenities}
        ${insights}
      </div>
      <footer class="smart-match-footer">
        <button type="button" class="smart-match-action" data-apartment-id="${apartment.id}">Mehr erfahren</button>
      </footer>
    `;

    return card;
  };

  const buildLandlordMatchCard = (match) => {
    const card = document.createElement('article');
    card.className = 'smart-match-card';

    const score = Math.round(match.score ?? 0);
    const tenant = match.tenant || {};

    const insights = Array.isArray(match.insights) && match.insights.length > 0
      ? `<ul class="smart-match-insights">${match.insights.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '';

    const distance = match.distanceKm !== null && match.distanceKm !== undefined
      ? `<div class="smart-match-distance">Entfernung: ${match.distanceKm} km</div>`
      : '';

    card.innerHTML = `
      <header class="smart-match-card-header">
        <div>
          <h4>${tenant.firstName || tenant.lastName ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() : 'Interessent'}</h4>
          <div class="smart-match-score" aria-label="Match Score">
            <span>${score}</span>
            <small>Score</small>
          </div>
        </div>
        <p class="smart-match-location">${match.apartmentTitle || 'Zugewiesenes Inserat'}</p>
      </header>
      <div class="smart-match-body">
        ${tenant.email ? `<div class="smart-match-contact"><i class="fa fa-envelope"></i> ${tenant.email}</div>` : ''}
        ${tenant.phone ? `<div class="smart-match-contact"><i class="fa fa-phone"></i> ${tenant.phone}</div>` : ''}
        ${distance}
        ${insights}
      </div>
      <footer class="smart-match-footer">
        <button type="button" class="smart-match-action" data-tenant-id="${match.tenantId}">Kontakt aufnehmen</button>
      </footer>
    `;

    return card;
  };

  const populatePreferencesForm = (form, data) => {
    if (!form || !data) return;

    const prefs = data.data || data;
    const normalised = prefs && prefs.raw ? prefs : prefs;

    const getField = (name) => form.querySelector(`[name="${name}"]`);

    const assignValue = (name, value) => {
      const field = getField(name);
      if (!field) return;
      if (field.type === 'checkbox') {
        field.checked = Boolean(value);
      } else {
        field.value = value ?? '';
      }
    };

    assignValue('budgetMin', normalised.budgetMin ?? normalised.budget_min ?? '');
    assignValue('budgetMax', normalised.budgetMax ?? normalised.budget_max ?? '');
    assignValue('maxDistanceKm', normalised.maxDistanceKm ?? normalised.max_distance_km ?? '');
    assignValue('moveInDate', normalised.moveInDate ? new Date(normalised.moveInDate).toISOString().slice(0, 10) : '');

    const petField = getField('petFriendly');
    if (petField) {
      const petValue = normalised.petFriendly;
      petField.value = petValue === null || petValue === undefined ? '' : String(Boolean(petValue));
    }

    const furnishedField = getField('furnished');
    if (furnishedField) {
      const furnishedValue = normalised.furnished;
      furnishedField.value = furnishedValue === null || furnishedValue === undefined ? '' : String(Boolean(furnishedValue));
    }

    assignValue('preferredCities', toFormListValue(normalised.preferredCities));
    assignValue('propertyTypes', toFormListValue(normalised.propertyTypes));
    assignValue('amenities', toFormListValue(normalised.amenities));
  };

  const extractPreferencesFromForm = (form) => {
    if (!form) return {};
    const formData = new FormData(form);

    const petFriendly = sanitiseBoolean(formData.get('petFriendly'));
    const furnished = sanitiseBoolean(formData.get('furnished'));

    return {
      budgetMin: sanitiseNumber(formData.get('budgetMin')),
      budgetMax: sanitiseNumber(formData.get('budgetMax')),
      maxDistanceKm: sanitiseNumber(formData.get('maxDistanceKm')),
      petFriendly: petFriendly === null ? undefined : petFriendly,
      furnished: furnished === null ? undefined : furnished,
      preferredMoveInDate: formData.get('moveInDate') || undefined,
      preferences: {
        cities: splitInputList(formData.get('preferredCities')),
        propertyTypes: splitInputList(formData.get('propertyTypes')),
        amenities: splitInputList(formData.get('amenities'))
      }
    };
  };

  const SmartMatchingUI = {
    async initTenantDashboard(config) {
      const defaults = {
        matchListSelector: '#tenant-match-list',
        preferenceFormSelector: '#tenant-preferences-form',
        alertSelector: '#smart-matching-alert'
      };
      const settings = { ...defaults, ...config };
      const listEl = document.querySelector(settings.matchListSelector);
      const formEl = document.querySelector(settings.preferenceFormSelector);

      if (!listEl) {
        console.warn('SmartMatchingUI: Match list element not found for tenant dashboard');
      }

      if (formEl && !formEl.dataset.smartMatchingInitialised) {
        formEl.addEventListener('submit', async (event) => {
          event.preventDefault();
          try {
            renderAlert(settings.alertSelector, 'info', 'Speichere Präferenzen …');
            const payload = extractPreferencesFromForm(formEl);
            const response = await fetchJson('/preferences', {
              method: 'POST',
              body: JSON.stringify({ ...payload, userType: 'tenant' })
            });
            populatePreferencesForm(formEl, response.data || response);
            renderAlert(settings.alertSelector, 'success', 'Präferenzen gespeichert. Matches werden aktualisiert …');
            await this.refreshTenantMatches(settings);
          } catch (error) {
            const message = parseErrorMessage(error, 'Präferenzen konnten nicht gespeichert werden.');
            renderAlert(settings.alertSelector, 'error', message);
          }
        });
        formEl.dataset.smartMatchingInitialised = 'true';
      }

      await Promise.all([
        this.loadTenantPreferences(settings),
        this.refreshTenantMatches(settings)
      ]).catch((error) => {
        const message = parseErrorMessage(error, 'Smart Matching konnte nicht gestartet werden.');
        renderAlert(settings.alertSelector, 'error', message);
      });
    },

    async loadTenantPreferences(config) {
      const formEl = document.querySelector(config.preferenceFormSelector);
      if (!formEl) return;

      try {
        renderAlert(config.alertSelector, 'info', 'Lade Präferenzen …');
        const response = await fetchJson('/preferences?userType=tenant');
        if (!response?.success) {
          renderAlert(config.alertSelector, 'warning', 'Es wurden keine gespeicherten Präferenzen gefunden. Bitte ergänzen Sie Ihre Wunschdaten.');
        } else {
          renderAlert(config.alertSelector, 'success', 'Präferenzen geladen.');
        }
        populatePreferencesForm(formEl, response.data || response);
      } catch (error) {
        const message = parseErrorMessage(error, 'Präferenzen konnten nicht geladen werden.');
        renderAlert(config.alertSelector, 'error', message);
      }
    },

    async refreshTenantMatches(config) {
      const listEl = document.querySelector(config.matchListSelector);
      if (!listEl) return;

      listEl.innerHTML = '';
      listEl.classList.add('smart-match-list-loading');

      try {
        renderAlert(config.alertSelector, 'info', 'Berechne passende Wohnungen …');
        const response = await fetchJson('/tenant');
        const matches = Array.isArray(response?.data) ? response.data : [];

        listEl.classList.remove('smart-match-list-loading');
        listEl.innerHTML = '';

        if (matches.length === 0) {
          const message = response?.meta?.preferenceFound === false
            ? 'Bitte hinterlegen Sie zuerst Ihre Wunschkriterien, um passende Angebote zu erhalten.'
            : 'Aktuell sind keine passenden Angebote verfügbar.';
          listEl.appendChild(createEmptyState(message));
        } else {
          matches.forEach((match) => listEl.appendChild(buildMatchCard(match)));
        }

        if (response?.meta?.fallbackUsed) {
          renderAlert(config.alertSelector, 'warning', 'Es konnte keine Datenbankverbindung hergestellt werden. Es werden Demo-Treffer angezeigt.');
        } else {
          renderAlert(config.alertSelector, 'success', `Top ${matches.length} Treffer geladen.`);
        }
      } catch (error) {
        listEl.classList.remove('smart-match-list-loading');
        const message = parseErrorMessage(error, 'Matching konnte nicht geladen werden.');
        renderAlert(config.alertSelector, 'error', message);
        listEl.appendChild(createEmptyState('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.'));
      }
    },

    async initLandlordDashboard(config) {
      const defaults = {
        matchListSelector: '#landlord-match-list',
        preferenceFormSelector: '#landlord-preferences-form',
        alertSelector: '#landlord-matching-alert'
      };
      const settings = { ...defaults, ...config };
      const listEl = document.querySelector(settings.matchListSelector);
      const formEl = document.querySelector(settings.preferenceFormSelector);

      if (formEl && !formEl.dataset.smartMatchingInitialised) {
        formEl.addEventListener('submit', async (event) => {
          event.preventDefault();
          try {
            renderAlert(settings.alertSelector, 'info', 'Speichere Matching-Filter …');
            const payload = extractPreferencesFromForm(formEl);
            const response = await fetchJson('/preferences', {
              method: 'POST',
              body: JSON.stringify({ ...payload, userType: 'landlord' })
            });
            populatePreferencesForm(formEl, response.data || response);
            renderAlert(settings.alertSelector, 'success', 'Filter gespeichert. Kandidaten werden aktualisiert …');
            await this.refreshLandlordMatches(settings);
          } catch (error) {
            const message = parseErrorMessage(error, 'Filter konnten nicht gespeichert werden.');
            renderAlert(settings.alertSelector, 'error', message);
          }
        });
        formEl.dataset.smartMatchingInitialised = 'true';
      }

      await Promise.all([
        this.loadLandlordPreferences(settings),
        this.refreshLandlordMatches(settings)
      ]).catch((error) => {
        const message = parseErrorMessage(error, 'Smart Matching konnte nicht initialisiert werden.');
        renderAlert(settings.alertSelector, 'error', message);
      });
    },

    async loadLandlordPreferences(config) {
      const formEl = document.querySelector(config.preferenceFormSelector);
      if (!formEl) return;
      try {
        const response = await fetchJson('/preferences?userType=landlord');
        populatePreferencesForm(formEl, response.data || response);
      } catch (error) {
        console.warn('Landlord preferences could not be loaded', error);
      }
    },

    async refreshLandlordMatches(config) {
      const listEl = document.querySelector(config.matchListSelector);
      if (!listEl) return;

      listEl.innerHTML = '';
      listEl.classList.add('smart-match-list-loading');

      try {
        renderAlert(config.alertSelector, 'info', 'Suche passende Interessenten …');
        const response = await fetchJson('/landlord');
        const matches = Array.isArray(response?.data) ? response.data : [];

        listEl.classList.remove('smart-match-list-loading');
        listEl.innerHTML = '';

        if (matches.length === 0) {
          const message = response?.meta?.message || 'Momentan wurden keine passenden Interessenten gefunden.';
          listEl.appendChild(createEmptyState(message));
        } else {
          matches.forEach((match) => listEl.appendChild(buildLandlordMatchCard(match)));
        }

        if (response?.meta?.warnings?.length) {
          renderAlert(config.alertSelector, 'warning', response.meta.warnings.join(' | '));
        } else {
          renderAlert(config.alertSelector, 'success', `${matches.length} qualifizierte Interessenten geladen.`);
        }
      } catch (error) {
        listEl.classList.remove('smart-match-list-loading');
        const message = parseErrorMessage(error, 'Interessenten konnten nicht geladen werden.');
        renderAlert(config.alertSelector, 'error', message);
        listEl.appendChild(createEmptyState('Bitte versuchen Sie es später erneut.'));
      }
    }
  };

  window.SmartMatchingUI = SmartMatchingUI;
})(window);
