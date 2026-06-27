export function onHydrationEnd() {
  const script = document.createElement("script");
  script.src = "https://umami.relicware.co/recorder.js";
  script.defer = true;
  script.dataset.websiteId = "80d4a2ff-81ad-4a76-89ba-a7b683cf2ebf";
  script.dataset.maskLevel = "moderate";
  script.dataset.maxDuration = "300000";
  script.dataset.sampleRate = "0.5";
  document.head.appendChild(script);
}
