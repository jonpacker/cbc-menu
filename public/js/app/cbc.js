import 'babel-polyfill'
import App from './app'

window.initBeerApp = (initData) => {
  setTimeout(() => {
    const index = document.createElement('script');
    index.setAttribute('type', 'text/javascript');
    index.setAttribute('src','/index.js');
    document.head.appendChild(index);
  }, 3000);
  return new App(initData);
}
