let pendingRestore = null;

export function initializeFlyerContinuousRegistration() {
  document.addEventListener('submit', handleFlyerRegistrationSubmit, true);
}

function handleFlyerRegistrationSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'flyerRegistrationForm') return;

  const map = window.__SMART_MAP_INSTANCE__;
  const center = map?.getCenter();
  const zoom = map?.getZoom();
  const isMapRegistration = Boolean(
    document.querySelector('#flyerRegistrationPanel .flyer-registration-map:not([hidden])')
  );

  pendingRestore = {
    center: center ? { lat: center.lat(), lng: center.lng() } : null,
    zoom: Number.isFinite(zoom) ? zoom : null,
    isMapRegistration,
  };

  [0, 80, 250, 600].forEach((delay) => {
    window.setTimeout(restoreMapAndContinue, delay);
  });
}

function restoreMapAndContinue() {
  if (!pendingRestore) return;

  const map = window.__SMART_MAP_INSTANCE__;
  if (map && pendingRestore.center) map.setCenter(pendingRestore.center);
  if (map && Number.isFinite(pendingRestore.zoom)) map.setZoom(pendingRestore.zoom);

  const detailPanel = document.querySelector('#flyerDetailPanel');
  if (detailPanel) detailPanel.hidden = true;

  if (pendingRestore.isMapRegistration) {
    const registrationPanel = document.querySelector('#flyerRegistrationPanel');
    const launcher = document.querySelector('[data-open-flyer-nearby-picker]');
    if (registrationPanel?.hidden && launcher) launcher.click();
  }

  if (document.querySelector('#flyerRegistrationPanel:not([hidden])')) {
    pendingRestore = null;
  }
}
