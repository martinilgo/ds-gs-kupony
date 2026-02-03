<script>
(function(){
  var STORE_MAP = {
    'www.design-shop.sk': 'DesignShop Sk',
    'www.design-shop.cz': 'DesignShop Cz',
    'www.garden-shop.sk': 'GardenShop Sk',
    'www.gardeneshop.cz': 'GardenShop Cz'
  };

  var currentStore = STORE_MAP[location.hostname];
  if (!currentStore) return;

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

      var bgStyle = '#000';
      if (banner.bgColors && banner.bgColors[0]) {
        bgStyle = banner.bgColors[0] === banner.bgColors[1]
          ? banner.bgColors[0]
          : 'linear-gradient(135deg,' + banner.bgColors[0] + ',' + banner.bgColors[1] + ')';
      }

      var css = document.createElement('style');
      css.appendChild(document.createTextNode(
        '#promoBanner{position:fixed;top:0;left:0;right:0;color:#fff;padding:12px 40px 12px 20px;text-align:center;font-size:15px;z-index:999999;font-family:Arial,sans-serif;animation:promoBannerSlide .4s ease-out}' +
        '@keyframes promoBannerSlide{from{transform:translateY(-100%)}to{transform:translateY(0)}}' +
        '#promoBannerClose{position:absolute;right:12px;top:8px;cursor:pointer;font-size:18px;color:#fff}' +
        '#promoBanner .coupon{background:#fff;color:#000;padding:3px 8px;border-radius:4px;font-weight:bold;margin-left:5px;cursor:pointer;display:inline-block}' +
        '#promoBanner .copied{margin-left:8px;font-size:14px;color:#0f0;display:none}' +
        '#promoCountdown{font-size:12px;color:rgba(255,255,255,0.7);margin-left:10px;animation:fadeBlink 3s ease-in-out infinite}' +
        '.blinkColon{display:inline-block;animation:blink 1s infinite}' +
        '@keyframes blink{0%{opacity:1}50%{opacity:0}100%{opacity:1}}' +
        '@keyframes fadeBlink{0%{opacity:1}50%{opacity:0.5}100%{opacity:1}}'
      ));
      document.head.appendChild(css);

      var el = document.createElement('div');
      el.id = 'promoBanner';
      el.style.background = bgStyle;
      el.innerHTML =
        '<span id="promoBannerClose">&#10006;</span>' +
        (banner.title ? banner.title : '') +
        (banner.text ? ' ' + banner.text : '') +
        ' <strong>Kód:</strong> ' +
        '<span class="coupon" id="couponBtn">' + banner.code + '</span>' +
        '<span id="copyMsg" class="copied">Skopírované!</span>' +
        (banner.countdown ? '<span id="promoCountdown"></span>' : '');

      document.body.appendChild(el);
      document.body.style.marginTop = el.offsetHeight + 'px';

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
        countdownEl.innerHTML =
          ' (platí ' + d + 'd ' +
          h + '<span class="blinkColon">:</span>' +
          m + 'm)';
      }

      if (banner.countdown && endDate) {
        updateCountdown();
        timerId = setInterval(updateCountdown, 60000);
      }
    })
    .catch(function(e){ console.warn('Promo banner error:', e); });
})();
</script>
