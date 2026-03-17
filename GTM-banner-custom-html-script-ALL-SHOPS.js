(function () {
  var STORE_MAP = {
    'www.design-shop.sk': 'DesignShop Sk',
    'www.design-shop.cz': 'DesignShop Cz',
    'www.garden-shop.sk': 'GardenShop Sk',
    'www.gardeneshop.cz': 'GardenShop Cz'
  };

  var currentStore = STORE_MAP[location.hostname];
  if (!currentStore) return;

  var isCz = currentStore.indexOf('Cz') !== -1;
  var JSON_URL = 'https://script.google.com/macros/s/AKfycbw7Ou1LxAG_nrjKKXbPmuICuUzAwnVfbmVP5iaGwsTg5Q5sTJhS1a-z3_MAaLygvul-/exec?mode=banners';
  var STORAGE_PREFIX = 'promoBanner_closed_';
  var POLL_INTERVAL_MS = 5000;

  var currentBanner = null;
  var currentBannerSignature = '';
  var currentBannerElement = null;
  var currentStyleElement = null;
  var countdownTimerId = null;
  var syncInFlight = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseExpiryDate(value) {
    if (!value) return null;
    var parts = String(value).replace(/\s/g, '').split('.');
    if (parts.length < 3) return null;
    return new Date(parts[2], parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 23, 59, 59);
  }

  function getBannerStorageKey(banner) {
    var revision = banner && (banner.updatedAt || banner.expiry || banner.dateTo || 'default');
    var safeRevision = String(revision).replace(/[^a-zA-Z0-9_-]+/g, '_');
    var safeStore = String((banner && banner.store) || currentStore || 'store').replace(/[^a-zA-Z0-9_-]+/g, '_');
    var safeCode = String((banner && banner.code) || 'code').replace(/[^a-zA-Z0-9_-]+/g, '_');
    return STORAGE_PREFIX + safeStore + '_' + safeCode + '_' + safeRevision;
  }

  function getBannerSignature(banner) {
    if (!banner) return '';
    return JSON.stringify({
      store: banner.store || '',
      code: banner.code || '',
      title: banner.title || '',
      text: banner.text || '',
      rotatingText: banner.rotatingText || [],
      active: !!banner.active,
      countdown: !!banner.countdown,
      bgColors: banner.bgColors || [],
      bannerType: banner.bannerType || 'topbar',
      popupPosition: banner.popupPosition || 'bottom-center',
      bannerStyle: banner.bannerStyle || {},
      updatedAt: banner.updatedAt || '',
      expiry: banner.expiry || banner.dateTo || ''
    });
  }

  function fetchBanners() {
    return fetch(JSON_URL + '&t=' + Date.now())
      .then(function (response) { return response.json(); })
      .then(function (payload) {
        if (Array.isArray(payload)) return payload;
        return payload && Array.isArray(payload.banners) ? payload.banners : [];
      });
  }

  function pickBanner(banners) {
    if (!Array.isArray(banners) || !banners.length) return null;

    for (var i = 0; i < banners.length; i += 1) {
      var banner = banners[i];
      if (!banner || !banner.active) continue;
      if (banner.store !== currentStore) continue;
      if (localStorage.getItem(getBannerStorageKey(banner))) continue;

      var expirySource = banner.dateTo || banner.expiry;
      var expiryDate = parseExpiryDate(expirySource);
      if (expiryDate && new Date() > expiryDate) continue;

      return banner;
    }

    return null;
  }

  function removeCurrentBanner() {
    if (countdownTimerId) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }

    if (currentBannerElement && currentBannerElement.parentNode) {
      currentBannerElement.parentNode.removeChild(currentBannerElement);
    }

    if (currentStyleElement && currentStyleElement.parentNode) {
      currentStyleElement.parentNode.removeChild(currentStyleElement);
    }

    document.body.style.marginTop = '0px';
    currentBannerElement = null;
    currentStyleElement = null;
    currentBanner = null;
    currentBannerSignature = '';
  }

  function buildRotatorContent(banner, rotationSpeed, rotationEffect) {
    var textLines = [];
    if (Array.isArray(banner.rotatingText) && banner.rotatingText.length) {
      banner.rotatingText.forEach(function (line) {
        if (line && String(line).trim()) {
          textLines.push(String(line).trim());
        }
      });
    }

    var bannerTitle = banner.title ? String(banner.title).trim() : '';
    var bannerText = banner.text ? String(banner.text).trim() : '';

    if (bannerTitle) {
      var titlePos = textLines.indexOf(bannerTitle);
      if (titlePos > -1 && titlePos !== 0) {
        textLines.splice(titlePos, 1);
      }
      if (titlePos !== 0) {
        textLines.unshift(bannerTitle);
      }
    }

    if (bannerText && textLines.indexOf(bannerText) === -1) {
      textLines.push(bannerText);
    }

    if (!textLines.length) {
      return {
        html: '',
        css: '',
        titleHtml: bannerTitle
          ? '<span class="banner-title">' + escapeHtml(bannerTitle) + '</span>'
          : '<span class="banner-title">' + escapeHtml(isCz ? 'Sleva pro Vas!' : 'Zlava pre Vas!') + '</span>',
        descHtml: bannerText ? '<span class="banner-desc">' + escapeHtml(bannerText) + '</span>' : ''
      };
    }

    var totalDuration = rotationSpeed * textLines.length;

    if (rotationEffect === 'fade') {
      var fadeItems = textLines.map(function (line, idx) {
        var delay = (idx * rotationSpeed).toFixed(1);
        return '<span class="banner-fade-item" style="animation-delay:' + delay + 's">' + escapeHtml(line) + '</span>';
      }).join('');
      var showPct = 100 / textLines.length;
      var fadePct = showPct * 0.2;

      return {
        html: '<span class="banner-text-rotator">' + fadeItems + '</span>',
        css:
          '.banner-text-rotator{display:inline-grid;vertical-align:middle;}' +
          '.banner-fade-item{grid-area:1/1;white-space:nowrap;line-height:1.3;font-size:13px;font-weight:600;opacity:0;animation:bannerFadeItem ' + totalDuration + 's linear infinite}' +
          '@keyframes bannerFadeItem{0%{opacity:0}' + fadePct.toFixed(1) + '%{opacity:1}' + (showPct - fadePct).toFixed(1) + '%{opacity:1}' + (showPct + fadePct).toFixed(1) + '%{opacity:0}100%{opacity:0}}',
        titleHtml: '',
        descHtml: ''
      };
    }

    var inner = textLines.map(function (line) {
      return '<div>' + escapeHtml(line) + '</div>';
    }).join('');
    var scrollKf = '';
    if (textLines.length > 1) {
      var n = textLines.length;
      var step = 100 / n;
      var pause = step * 0.85;
      var frames = [];
      for (var fi = 0; fi < n; fi += 1) {
        var yPct = (fi * 100 / n).toFixed(1);
        frames.push((fi * step).toFixed(1) + '%{transform:translateY(-' + yPct + '%)}');
        frames.push((fi * step + pause).toFixed(1) + '%{transform:translateY(-' + yPct + '%)}');
      }
      frames.push('100%{transform:translateY(0)}');
      scrollKf = '@keyframes bannerTextScroll{' + frames.join('') + '}';
    } else {
      scrollKf = '@keyframes bannerTextScroll{0%,100%{transform:translateY(0)}}';
    }

    return {
      html: '<span class="banner-text-rotator"><span class="banner-text-rotator-inner">' + inner + '</span></span>',
      css:
        '.banner-text-rotator{display:inline-block;vertical-align:middle;overflow:hidden;height:17px;}' +
        '.banner-text-rotator-inner{display:flex;flex-direction:column;animation:bannerTextScroll ' + totalDuration + 's ease-in-out infinite;}' +
        '.banner-text-rotator-inner div{line-height:1.3;font-size:13px;font-weight:600;}' +
        scrollKf,
      titleHtml: '',
      descHtml: ''
    };
  }

  function renderBanner(banner) {
    removeCurrentBanner();

    var styleConfig = banner.bannerStyle || {};
    var bannerType = banner.bannerType || 'topbar';
    var popupPosition = banner.popupPosition || 'bottom-center';
    var textColor = styleConfig.textColor || '#fff';
    var fontSize = styleConfig.fontSize || '13px';
    var fontFamily = styleConfig.fontFamily || 'Arial,sans-serif';
    var heightStyle = styleConfig.height || 'auto';
    var borderRadius = styleConfig.borderRadius || '6px';
    var rotationSpeed = styleConfig.rotationSpeed || 6;
    var rotationEffect = styleConfig.rotationEffect || 'fade';

    var defaultBg = '#000';
    if (banner.bgColors && banner.bgColors[0]) {
      defaultBg = banner.bgColors[0] === banner.bgColors[1]
        ? banner.bgColors[0]
        : 'linear-gradient(135deg,' + banner.bgColors[0] + ',' + banner.bgColors[1] + ')';
    }
    var finalBackground = styleConfig.backgroundGradient || styleConfig.background || defaultBg;
    var rotator = buildRotatorContent(banner, rotationSpeed, rotationEffect);

    var css = document.createElement('style');
    css.id = 'promoBannerStyle';
    css.appendChild(document.createTextNode(
      '#promoBanner{position:absolute;top:0;left:0;right:0;color:' + textColor + ';padding:6px 24px;text-align:center;font-size:' + fontSize + ';line-height:1.3;z-index:999999;font-family:' + fontFamily + ';border-radius:' + borderRadius + ';animation:promoBannerSlide .4s ease-out;display:flex;align-items:center;justify-content:center;gap:5px;border:0 !important;box-shadow:none !important;border-bottom:0 !important;border-bottom-width:0 !important;border-bottom-style:none !important;border-bottom-color:transparent !important;}' +
      '@keyframes promoBannerSlide{from{transform:translateY(-90%)}to{transform:translateY(0)}}' +
      '#promoBannerClose{position:absolute;right:10px;top:6px;cursor:pointer;font-size:18px;color:#fff}' +
      '#promoBanner .coupon{background:#fff;color:#000;padding:2px 6px;border-radius:4px;font-weight:bold;margin-left:5px;cursor:pointer;display:inline-block;font-size:12px}' +
      '#promoBanner .copied{margin-left:6px;font-size:11px;color:#0f0;display:none}' +
      '#promoCountdown{font-size:11px;color:' + textColor + ';margin-left:10px;animation:fadeBlink 6s ease-in-out infinite}' +
      '.blinkColon{display:inline-block;animation:blink 1.5s infinite}' +
      '.banner-title{font-weight:600;margin-right:2px;}' +
      '.banner-desc{opacity:0.9;}' +
      rotator.css +
      '@keyframes blink{0%{opacity:1}50%{opacity:0}100%{opacity:1}}' +
      '@keyframes fadeBlink{0%{opacity:1}50%{opacity:0.4}100%{opacity:1}}' +
      '#promoBanner,#promoBanner::before,#promoBanner::after,#promoBanner *{border:0!important;box-shadow:none!important;border-bottom:0!important;border-bottom-width:0!important;border-bottom-style:none!important;border-bottom-color:transparent!important;}'
    ));
    document.head.appendChild(css);

    var el = document.createElement('div');
    el.id = 'promoBanner';
    el.style.background = finalBackground;
    el.style.borderRadius = borderRadius;
    el.innerHTML =
      '<span id="promoBannerClose">&#10006;</span>' +
      rotator.titleHtml + (rotator.html || rotator.descHtml) +
      ' Kod: ' +
      '<span class="coupon" id="couponBtn">' + escapeHtml(banner.code) + '</span>' +
      '<span id="copyMsg" class="copied">' + escapeHtml(isCz ? 'Zkopirovano!' : 'Skopirovane!') + '</span>' +
      (banner.countdown ? '<span id="promoCountdown"></span>' : '');

    el.style.color = textColor;
    el.style.fontSize = fontSize;
    if (styleConfig.fontFamily) el.style.fontFamily = styleConfig.fontFamily;
    if (heightStyle && heightStyle !== 'auto') {
      el.style.minHeight = heightStyle;
      el.style.height = 'auto';
    }
    el.style.border = '0';
    el.style.borderBottom = '0';
    el.style.boxShadow = 'none';

    function applyPopupPosition(pos) {
      el.style.bottom = '20px';
      el.style.top = 'auto';
      el.style.transform = '';
      switch (pos) {
        case 'bottom-left':
          el.style.left = '20px';
          el.style.right = 'auto';
          break;
        case 'bottom-center':
          el.style.left = '50%';
          el.style.right = 'auto';
          el.style.transform = 'translateX(-50%)';
          break;
        case 'bottom-right':
          el.style.right = '20px';
          el.style.left = 'auto';
          break;
        case 'center':
          el.style.top = '50%';
          el.style.left = '50%';
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          el.style.transform = 'translate(-50%, -50%)';
          break;
      }
    }

    if (bannerType === 'popup') {
      el.style.maxWidth = styleConfig.maxWidth || '360px';
      el.style.minWidth = styleConfig.minWidth || '260px';
      el.style.margin = '0';
      el.style.left = '20px';
      el.style.right = 'auto';
      el.style.bottom = '20px';
      el.style.top = 'auto';
      el.style.transform = '';
      applyPopupPosition(popupPosition);
    } else {
      el.style.top = '0';
      el.style.left = '0';
      el.style.right = '0';
      el.style.bottom = 'auto';
      el.style.transform = 'none';
      el.style.borderRadius = '0';
    }

    document.body.appendChild(el);
    if (bannerType === 'topbar') {
      document.body.style.marginTop = el.offsetHeight + 'px';
    }

    var couponBtn = document.getElementById('couponBtn');
    if (couponBtn) {
      couponBtn.onclick = function () {
        var code = banner.code;
        function showCopied() {
          var copyMsg = document.getElementById('copyMsg');
          if (!copyMsg) return;
          copyMsg.style.display = 'inline';
          setTimeout(function () {
            if (copyMsg) copyMsg.style.display = 'none';
          }, 1500);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(showCopied);
        } else {
          var temp = document.createElement('input');
          temp.value = code;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.parentNode.removeChild(temp);
          showCopied();
        }
      };
    }

    function closeBanner() {
      localStorage.setItem(getBannerStorageKey(banner), '1');
      removeCurrentBanner();
    }

    var closeBtn = document.getElementById('promoBannerClose');
    if (closeBtn) {
      closeBtn.onclick = closeBanner;
    }

    var countdownEl = banner.countdown ? document.getElementById('promoCountdown') : null;
    var endDate = parseExpiryDate(banner.dateTo || banner.expiry);

    function updateCountdown() {
      if (!countdownEl || !endDate) return;
      var diff = endDate - new Date();
      if (diff <= 0) {
        closeBanner();
        return;
      }

      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var formattedMinutes = String(m).padStart(2, '0');
      var formattedHours = String(h).padStart(2, '0');
      countdownEl.innerHTML = 'Plati ' + d + 'd ' + formattedHours + '<span class="blinkColon">:</span>' + formattedMinutes + 'm';
    }

    if (banner.countdown && endDate) {
      updateCountdown();
      countdownTimerId = setInterval(updateCountdown, 60000);
    }

    currentBanner = banner;
    currentBannerSignature = getBannerSignature(banner);
    currentBannerElement = el;
    currentStyleElement = css;
  }

  function syncBanner() {
    if (syncInFlight) return;
    syncInFlight = true;

    fetchBanners()
      .then(function (banners) {
        var nextBanner = pickBanner(banners);
        var nextSignature = getBannerSignature(nextBanner);

        if (!nextBanner) {
          if (currentBannerElement) {
            removeCurrentBanner();
          }
          return;
        }

        if (nextSignature !== currentBannerSignature) {
          renderBanner(nextBanner);
        }
      })
      .catch(function (error) {
        console.warn('Promo banner error:', error);
      })
      .finally(function () {
        syncInFlight = false;
      });
  }

  syncBanner();
  setInterval(syncBanner, POLL_INTERVAL_MS);
})();
