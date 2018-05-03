import io from 'socket.io-client'
import Shuffle from 'shufflejs'
import {tween} from 'shifty'

const ANIMATION_SPEED = 1500;

export default class LeaderBeer {
  attachToView(view) {
    this.view = view.find('ul');
    this.initUi();
  }

  detachFromView() {
    this.deinitUi();
    delete this.view;
  }

  setBeers(beers) {
    beers.forEach((beer, index) => {
      beer.bayesianRatingFixed = beer.bayesianRating.toFixed(2);
      beer.rollingAverageRatingFixed = beer.rollingAverageRating.toFixed(2);
      beer.index = index;
      beer.humanIndex = index+1;
    });
    this.beers = beers;
  }

  updateBeers(beers) {
    this.setBeers(beers);
    if (this.view) this.updateUi();
  }

  initUi() {
    if (!this.view) return;
    this._shuff = new Shuffle(this.view, {
      itemSelector: 'li',
      sizer: this.view[0],
      speed: ANIMATION_SPEED
    });
  }

  deinitUi() {
    if (!this._shuff) return;
    this._shuff.destroy();
    delete this._shuff;
  }

  updateUi() {
    if (!this.view || !this._shuff) return;
    const toAdd = [];
    const dropToken = `lb_${Date.now()}`;
    this.beers.forEach((rating, i) => {
      const element = this.view.find(`[data-bid="${rating.beer.bid}"]`);

      if (!element.length) {
        const newEl = createNewElementForBeer(rating, i);
        newEl.setAttribute('data-drop-token', dropToken);
        this.view.append(newEl);
        toAdd.push(newEl);
        return;
      } else {
        element.attr('data-drop-token', dropToken);
      }

      const countElement = element.find('.count');
      const ratingElement = element.find('.rating');
      const rankingElement = element.find('.ranking')

      element.find('.unweighted').text(rating.rollingAverageRating.toFixed(2));

      const fromRating = parseFloat(element.attr('data-rating'));
      const fromIndex = parseInt(element.attr('data-index'), 10);
      const fromCount = parseInt(countElement.text());

      element.attr('data-rating', rating.bayesianRating);
      element.attr('data-index', i);

      let rankingRoundFunc = 'floor';
      if (fromIndex < i) rankingRoundFunc = 'ceil';

      tween({
        from: {x: 0},
        to: {x: 1},
        duration: ANIMATION_SPEED,
        step: ({x}) => {
          if (fromIndex != i) {
            rankingElement.text(Math[rankingRoundFunc](fromIndex + 1 + (i - fromIndex) * x));
          }
          if (fromRating != rating.bayesianRating) ratingElement.text((fromRating + (rating.bayesianRating - fromRating) * x).toFixed(2));
          if (fromCount != rating.validCheckinCount) countElement.text(Math.round(fromCount + (rating.validCheckinCount - fromCount) * x));
        }
      });
    })
    const toRemove = this.view.find(`.beer-item:not([data-drop-token="${dropToken}"])`);
    if (toRemove.length > 0) this._shuff.remove(toRemove);
    if (toAdd.length > 0) this._shuff.add(toAdd);
    this._shuff.sort({
      by: el => parseFloat(el.getAttribute('data-index'))
    });
  }
}

const createNewElementForBeer = (beer, i) => {
  const el = document.createElement('li');
  el.setAttribute('data-bid', beer.beer.bid);
  el.setAttribute('data-index', i);
  el.setAttribute('data-rating', beer.bayesianRating);
  el.className = 'beer-item';

  el.innerHTML = `
    <div class="ranking">${i+1}</div>
    <div class="beer">
      <span class="beer-name">${beer.beer.beer_name}</span>
      <span class="brewery-name">${beer.brewery.brewery_name}</span>
    </div>
    <div class="rating">${beer.bayesianRating.toFixed(2)}</div>
    <div class="count">${beer.validCheckinCount}</div>
    <div class="unweighted">${beer.rollingAverageRating.toFixed(2)}</div>
  `;

  return el;
};
