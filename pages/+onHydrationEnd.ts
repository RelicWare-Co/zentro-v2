export function onHydrationEnd() {
  const script = document.createElement("script");
  script.src = "https://umami.relicware.co/recorder.js";
  script.defer = true;
  script.dataset.websiteId = "3691bded-4b19-4c5e-8870-052e624423dc";
  script.dataset.maskLevel = "moderate";
  script.dataset.maxDuration = "300000";
  script.dataset.sampleRate = "0.5";
  document.head.appendChild(script);
}
