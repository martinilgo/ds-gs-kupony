(function(){
  var STORE_MAP = {
    'www.design-shop.sk': 'DesignShop Sk',
    'www.design-shop.cz': 'DesignShop Cz',
    'www.garden-shop.sk': 'GardenShop Sk',
    'www.gardeneshop.cz': 'GardenShop Cz'
  };

  var currentStore = STORE_MAP[location.hostname];
  if (!currentStore) return;
  var isCz = currentStore.indexOf('Cz') !== -1;

  var JSON_URL = 'https://raw.githubusercontent.com/martinilgo/ds-gs-kupony/main/banners.json';
  var STORAGE_PREFIX = 'promoBanner_closed_';

  fetch(JSON_URL + '?t=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(function(banners){
      if (!Array.isArray(banners) || !banners.length) return;

      var banner = null;
      var i, b, p, exp;
      for (i = 0; i < banners.length; i++) {
        b = banners[i];
        if (!b.active) continue;
        if (b.store !== currentStore) continue;
        if (localStorage.getItem(STORAGE_PREFIX + b.code)) continue;
        var expirySource = b.dateTo || b.expiry;
        if (expirySource) {
          p = expirySource.replace(/\s/g,'').split('.');
          exp = new Date(p[2], parseInt(p[1])-1, parseInt(p[0]), 23, 59, 59);
          if (new Date() > exp) continue;
        }
        banner = b;
        break;
      }
      if (!banner) return;

      var endDate = null;
      var dateText = banner.dateTo || banner.expiry;
      if (dateText) {
        var pp = dateText.replace(/\s/g,'').split('.');
        endDate = new Date(pp[2], parseInt(pp[1])-1, parseInt(pp[0]), 23, 59, 59);
      }

      var defaultBg = '#000';
      if (banner.bgColors && banner.bgColors[0]) {
        defaultBg = banner.bgColors[0] === banner.bgColors[1]
          ? banner.bgColors[0]
          : 'linear-gradient(135deg,' + banner.bgColors[0] + ',' + banner.bgColors[1] + ')';
      }
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
      var finalBackground = styleConfig.backgroundGradient || styleConfig.background || defaultBg;

      var textLines = [];
      if (Array.isArray(banner.rotatingText) && banner.rotatingText.length) {
        banner.rotatingText.forEach(function(line) {
          if (line && line.trim()) {
            textLines.push(line.trim());
          }
        });
      }
      var bannerTitle = banner.title ? banner.title.trim() : '';
      var bannerText = banner.text ? banner.text.trim() : '';
      if (bannerTitle) {
        var titlePos = textLines.indexOf(bannerTitle);
        if (titlePos > -1 && titlePos !== 0) {
          textLines.splice(titlePos, 1);
        }
        if (titlePos !== 0) {
          textLines.unshift(bannerTitle);
        }
      }
      if (bannerText) {
        if (textLines.indexOf(bannerText) === -1) {
          textLines.push(bannerText);
        }
      }
      var rotatorHtml = '';
      var rotatorCss = '';
      if (textLines.length) {
        var totalDuration = rotationSpeed * textLines.length;

        if (rotationEffect === 'fade') {
          var fadeItems = textLines.map(function(line, idx) {
            var delay = (idx * rotationSpeed).toFixed(1);
            return '<span class="banner-fade-item" style="animation-delay:' + delay + 's">' + line + '</span>';
          }).join('');
          rotatorHtml = '<span class="banner-text-rotator">' + fadeItems + '</span>';
          var showPct = 100 / textLines.length;
          var fadePct = showPct * 0.2;
          rotatorCss =
            '.banner-text-rotator{display:inline-grid;vertical-align:middle;}' +
            '.banner-fade-item{grid-area:1/1;white-space:nowrap;line-height:1.3;font-size:13px;font-weight:600;opacity:0;animation:bannerFadeItem ' + totalDuration + 's linear infinite}' +
            '@keyframes bannerFadeItem{0%{opacity:0}' + fadePct.toFixed(1) + '%{opacity:1}' + (showPct - fadePct).toFixed(1) + '%{opacity:1}' + (showPct + fadePct).toFixed(1) + '%{opacity:0}100%{opacity:0}}';
        } else {
          var inner = textLines.map(function(line) {
            return '<div>' + line + '</div>';
          }).join('');
          rotatorHtml = '<span class="banner-text-rotator"><span class="banner-text-rotator-inner">' + inner + '</span></span>';
          var scrollKf = '';
          if (textLines.length > 1) {
            var n = textLines.length;
            var step = 100 / n;
            var pause = step * 0.85;
            var frames = [];
            for (var fi = 0; fi < n; fi++) {
              var yPct = (fi * 100 / n).toFixed(1);
              frames.push((fi * step).toFixed(1) + '%{transform:translateY(-' + yPct + '%)}');
              frames.push((fi * step + pause).toFixed(1) + '%{transform:translateY(-' + yPct + '%)}');
            }
            frames.push('100%{transform:translateY(0)}');
            scrollKf = '@keyframes bannerTextScroll{' + frames.join('') + '}';
          } else {
            scrollKf = '@keyframes bannerTextScroll{0%,100%{transform:translateY(0)}}';
          }
          rotatorCss =
            '.banner-text-rotator{display:inline-block;vertical-align:middle;overflow:hidden;height:17px;}' +
            '.banner-text-rotator-inner{display:flex;flex-direction:column;animation:bannerTextScroll ' + totalDuration + 's ease-in-out infinite;}' +
            '.banner-text-rotator-inner div{line-height:1.3;font-size:13px;font-weight:600;}' +
            scrollKf;
        }
      }
      var titleHtml = '';
      if (!rotatorHtml) {
        if (banner.title) {
          titleHtml = '<span class="banner-title">' + banner.title + '</span>';
        } else if (!banner.text) {
          titleHtml = '<span class="banner-title">' + (isCz ? 'Sleva pro Vás!' : 'Zľava pre Vás!') + '</span>';
        }
      }
      var descHtml = '';
      if (!rotatorHtml && banner.text) {
        descHtml = '<span class="banner-desc">' + banner.text + '</span>';
      }

      var css = document.createElement('style');
      css.appendChild(document.createTextNode(
        '#promoBanner{position:fixed;left:0;right:0;color:' + textColor + ';padding:6px 24px;text-align:center;font-size:' + fontSize + ';line-height:1.3;z-index:999999;font-family:' + fontFamily + ';border-radius:' + borderRadius + ';animation:promoBannerSlide .4s ease-out;display:flex;align-items:center;justify-content:center;gap:5px;border:0 !important;box-shadow:none !important;border-bottom:0 !important;}' +
        '@keyframes promoBannerSlide{from{transform:translateY(-90%)}to{transform:translateY(0)}}' +
        '#promoBannerClose{position:absolute;right:10px;top:6px;cursor:pointer;font-size:18px;color:#fff}' +
        '#promoBanner .coupon{background:#fff;color:#000;padding:2px 6px;border-radius:4px;font-weight:bold;margin-left:5px;cursor:pointer;display:inline-block;font-size:12px}' +
        '#promoBanner .copied{margin-left:6px;font-size:11px;color:#0f0;display:none}' +
        '#promoCountdown{font-size:11px;color:' + textColor + ';margin-left:10px;animation:fadeBlink 6s ease-in-out infinite}' +
        '.blinkColon{display:inline-block;animation:blink 1.5s infinite}' +
        '.banner-title{font-weight:600;margin-right:2px;}' +
        '.banner-desc{opacity:0.9;}' +
        rotatorCss +
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
        titleHtml + (rotatorHtml || descHtml) +
        ' Kód: ' +
        '<span class="coupon" id="couponBtn">' + banner.code + '</span>' +
        '<span id="copyMsg" class="copied">' + (isCz ? 'Zkopírováno!' : 'Skopírované!') + '</span>' +
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
      } else {
        document.body.style.marginTop = '0px';
      }

      document.getElementById('couponBtn').onclick = function(){
        var code = banner.code;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(function(){
            document.getElementById('copyMsg').style.display = 'inline';
            setTimeout(function(){ document.getElementById('copyMsg').style.display = 'none'; }, 1500);
          });
        } else {
          var temp = document.createElement('input');
          temp.value = code;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.parentNode.removeChild(temp);
          document.getElementById('copyMsg').style.display = 'inline';
          setTimeout(function(){ document.getElementById('copyMsg').style.display = 'none'; }, 1500);
        }
      };

      function closeBanner(){
        if (el.parentNode) el.parentNode.removeChild(el);
        document.body.style.marginTop = '0px';
        localStorage.setItem(STORAGE_PREFIX + banner.code, '1');
      }

      document.getElementById('promoBannerClose').onclick = closeBanner;

      var countdownEl = banner.countdown ? document.getElementById('promoCountdown') : null;
      var timerId = null;

      function updateCountdown(){
        if (!countdownEl || !endDate) return;
        var diff = endDate - new Date();
        if (diff <= 0) { closeBanner(); clearInterval(timerId); return; }
        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var formattedMinutes = String(m).padStart(2, '0');
        var formattedHours = String(h).padStart(2, '0');
        var timeLabel = d + 'd ' + formattedHours + '<span class="blinkColon">:</span>' + formattedMinutes + 'm';
        countdownEl.innerHTML =
          'Platí ' + timeLabel;
      }

      if (banner.countdown && endDate) {
        updateCountdown();
        timerId = setInterval(updateCountdown, 60000);
      }
    })
    .catch(function(e){ console.warn('Promo banner error:', e); });
})();
