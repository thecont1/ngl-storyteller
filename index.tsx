
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Suppress harmless ResizeObserver loop limit errors
const resizeObserverLoopErr = 'ResizeObserver loop limit exceeded';
const originalError = window.console.error;
window.console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes(resizeObserverLoopErr)) {
    return;
  }
  originalError.call(window.console, ...args);
};
window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop limit exceeded' || e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    e.stopImmediatePropagation();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
