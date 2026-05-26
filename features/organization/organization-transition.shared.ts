export const ORGANIZATION_SWITCH_STORAGE_KEY = "zentro:org-switch";
export const ORGANIZATION_SWITCH_BOOT_OVERLAY_ID = "zentro-org-switch-boot";

export const ORGANIZATION_SWITCH_BOOT_SCRIPT = `(function(){try{if(sessionStorage.getItem("${ORGANIZATION_SWITCH_STORAGE_KEY}")!=="1")return;var root=document.documentElement;var overlay=document.createElement("div");overlay.id="${ORGANIZATION_SWITCH_BOOT_OVERLAY_ID}";overlay.setAttribute("aria-live","polite");overlay.style.cssText="position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#0f0f0f;color:#fafafa;";overlay.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:12px;font-family:system-ui,sans-serif;"><div style="width:32px;height:32px;border:2px solid rgba(250,250,250,0.15);border-top-color:#c8ff00;border-radius:9999px;animation:zentro-org-spin 0.8s linear infinite"></div><p style="margin:0;font-size:14px;color:#a1a1aa">Cambiando organización...</p></div>';var style=document.createElement("style");style.textContent="@keyframes zentro-org-spin{to{transform:rotate(360deg)}}";root.appendChild(style);root.appendChild(overlay);}catch(e){}})();`;

export function markOrganizationSwitchPending() {
  sessionStorage.setItem(ORGANIZATION_SWITCH_STORAGE_KEY, "1");
}

export function isOrganizationSwitchPending() {
  return sessionStorage.getItem(ORGANIZATION_SWITCH_STORAGE_KEY) === "1";
}

export function clearOrganizationSwitchPending() {
  sessionStorage.removeItem(ORGANIZATION_SWITCH_STORAGE_KEY);
}

export function clearOrganizationSwitchBootOverlay() {
  if (typeof document === "undefined") {
    return;
  }

  document.getElementById(ORGANIZATION_SWITCH_BOOT_OVERLAY_ID)?.remove();
  clearOrganizationSwitchPending();
}
