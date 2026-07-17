import { installMapCapture } from './modules/mapCapture.js';
import { initializeApp } from './modules/ui.js';
import { initializeFlyerMapPicker } from './modules/flyerMapPicker.js';
import { initializeFlyerContinuousRegistration } from './modules/flyerContinuousRegistration.js';
import { initializeFlyerDelete } from './modules/flyerDelete.js';
import { initializeFlyerSpreadsheetRoundTrip } from './modules/flyerSpreadsheetRoundTrip.js';

installMapCapture();
initializeApp();
initializeFlyerMapPicker();
initializeFlyerContinuousRegistration();
initializeFlyerDelete();
initializeFlyerSpreadsheetRoundTrip();