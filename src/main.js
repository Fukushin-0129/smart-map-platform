import { installMapCapture } from './modules/mapCapture.js';
import { initializeApp } from './modules/ui.js';
import { initializeFlyerMapPicker } from './modules/flyerMapPicker.js';
import { initializeFlyerContinuousRegistration } from './modules/flyerContinuousRegistration.js';

installMapCapture();
initializeApp();
initializeFlyerMapPicker();
initializeFlyerContinuousRegistration();
