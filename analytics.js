(() => {
  const measurementId = 'G-2J1TQTP4RN';
  const page = new URL(window.location.href);
  const attributionParams = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term',
    'utm_content', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
    'gclid', 'dclid', 'gbraid', 'wbraid'
  ]);

  // Keep campaign attribution while omitting application query parameters.
  for (const key of [...page.searchParams.keys()]) {
    if (!attributionParams.has(key)) page.searchParams.delete(key);
  }
  page.hash = '';
  const referrer = document.referrer ? new URL(document.referrer) : null;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_location: page.href,
    page_referrer: referrer ? referrer.origin + referrer.pathname : '',
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.appendChild(script);
})();
