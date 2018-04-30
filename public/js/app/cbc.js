import 'babel-polyfill'
import App from './app'

window.initBeerApp = (initData) => {
  return new App(initData);
}
