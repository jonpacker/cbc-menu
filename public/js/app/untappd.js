import config from '../../../config.json'
import _ from 'underscore'

export default class Untappd {
  constructor(app) {
    this.app = app;
  }

  async fetchUntappd(path, opts = {}) {
    const token = opts.token || this.app.db.untappdToken;
    delete opts.token;

    if (opts.body) {
      opts.body.access_token = token;
      opts.body = $.param(opts.body)
      const headers = new Headers();
      headers.append('Content-Type', 'application/x-www-form-urlencoded');
      headers.append('Content-Length', opts.body.length);
      opts.headers = headers;
    }

    const res = await fetch(`https://api.untappd.com/v4/${path}?access_token=${token}&${opts.query || ''}`, opts);
    return await res.json();
  }

  async readUntappdCheckins() {
    let start = 0, count = 0;
    if (localStorage.getItem('ut_uniques_start')
        && localStorage.getItem('unicorn_not_finished_flag') == '1') {
      start = parseInt(localStorage.getItem('ut_uniques_start'));
      count = parseInt(localStorage.getItem('ut_uniques_count')) || 0;
    }
    let result;
    while ((result = await this.fetchUntappd('/user/beers', {query: `offset=${start}&limit=50`})) &&
           result.meta.code == 200 && result.response.beers.count > 0) {
      start += result.response.beers.count;
      localStorage.setItem('ut_uniques_start', start);
      if (result.response.beers.count == 0) break;
      var checkins = result.response.beers.items;
      checkins.forEach(checkin => {
        const matchingBeers = this.app.beerset.getBeersIndexedBy('ut_bid', checkin.beer.bid);
        if (!matchingBeers) return;
        count++;
        this.app.updateBeerData(matchingBeers[0].id, {
          ut_h_ch: true,
          ut_h_ra: checkin.rating_score,
          ut_h_id: checkin.first_checkin_id
        });
      });
      localStorage.setItem('ut_uniques_count', count);
      $('.status-text').text(start + " beers read, " + count + " beers matched");
    }
    if (result.meta && result.meta.error_type) {
      localStorage.setItem('unicorn_not_finished_flag', '1');
    } else {
      localStorage.setItem('unicorn_not_finished_flag', '0');
      localStorage.removeItem('ut_uniques_count');
      localStorage.removeItem('ut_uniques_start');
    }

    return count;
  }

  async createCheckin(untappdBeerId, rating, text) {
    const res = await this.fetchUntappd('/checkin/add', {
      method: 'POST',
      body: {
        timezone: 'CET',
        gmt_offset: 2,
        bid: untappdBeerId,
        shout: text,
        foursquare_id: config.foursquareLocationId,
        geolat: config.locationLat,
        geolng: config.locationLon,
        rating: rating > 0 ? rating : undefined
      }
    })
      /*
    } catch (e) {
      loader.hide();
      const errorText = beer.find('.untappd-error-text');
      errorText.text('Error! 😰 Try again?! 🔂');
      setTimeout(function() {
        errorText.text('');
      }, 5000);
    }*/
    if (res.meta.code >= 300) {
      throw new Error(res.meta.error_type);
    }

  }
}
