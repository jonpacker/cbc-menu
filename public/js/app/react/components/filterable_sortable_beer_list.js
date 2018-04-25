import React from 'react'
import PropTypes from 'prop-types'
import BeerList from './beer_list'
import calcBeerList from '../../calc_beer_list'
const {Component} = React

console.log(require('../../app'))
export default class FilterableSortableBeerList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mini: props.app.db.mini,
      order: null,
      saved: null,
      tasted: null,
      today: null,
      metastyle: null
    };
    this.recalculateBeerList();
  }
  recalculateBeerList(state = this.state) {
    const {breweries, beer_count} = calcBeerList(this.props.beers, state);
    this.breweries = breweries;
    this.beer_count = beer_count;
  }
  toggleMini() {
    this.props.app.db.mini = !this.state.mini;
    this.setState({mini: !this.state.mini});
  }
  setOrder(order) {
    if (order == this.state.order) return;
    this.recalculateBeerList(Object.assign({}, this.state, {order}));
    this.setState({order});
  }
  setFilter(filter) {
    //todo - filtering with css
    this.recalculateBeerList(Object.assign({}, this.state, filter));
    this.setState(filter);
  }
  getClassList() {
    const classes = [this.props.session ? `${this.props.session} session` : 'beer-list'];
    classes.push(`mini-${!!this.state.mini}`);
    if (this.state.order != null) classes.push(`order-${this.state.order}`);
    if (this.state.metastyle != null) classes.push(`ms-${this.state.metastyle}`);
    if (this.state.tasted != null) classes.push(this.state.tasted);
    if (this.state.saved != null) classes.push(this.state.saved);
    if (this.state.today != null) classes.push('today');
    return classes;
  }
  render() {
    const classes = this.getClassList();
    const {breweries, beer_count} = this;
    const {app} = this.props;
    return (
      <div id="beerlist" className={classes.join(' ')}>
        <h1>
          {this.props.session ? `${this.props.session} session` : `all beers`}
          <sub>{beer_count} beers, {breweries.length} brewers listed</sub>
          <a className="back" href="#index">↫</a>
        </h1>
        <div className="container">
          <div className="order bar">
            <span className="info">Display Options</span>
            <a className="mini" onClick={() => this.toggleMini()}>Small UI</a>
            <span className="info">Sort by</span>
            <a className="site-bg-style ut_rating" onClick={() => this.setOrder('ut_rating')}> 
              <img src="/img/ut_icon_144.png"/> Rating
            </a>
              {!app.db.disableLiveRating &&
                <a className="site-bg-style avg live-rating" 
                   onClick={() => this.setOrder('live_rating')}>👥 Rating</a> }
            <a className="ordering order-location" onClick={() => this.setOrder('location')}>Location</a>
            <a className={`ordering ${this.state.order == null ? "order-by-name selected" : ""}`} 
              onClick={() => this.setOrder(null)}>Brewery</a>
          </div>
          <div className="filter bar">
            <span className="info">Filter by</span>
            <a className="tasted" onClick={() => this.setFilter({tasted: 'tasted'})}>✓</a>
            <a className="not-tasted" onClick={() => this.setFilter({tasted: 'not-tasted'})}>NOT ✓</a>
            <a className="saved" onClick={() => this.setFilter({saved: 'saved'})}>★</a>
            <a className="not-saved" onClick={() => this.setFilter({saved: 'not-saved'})}>NOT ★</a>
            <a className="today" onClick={() => this.setFilter({today: true})}>Only Today</a>
            <a onClick={() => this.setFilter({
              today: null,
              saved: null,
              tasted: null
            })}>✘ Reset</a>
          </div>
          <div className="key bar">
            <span className="info">Filter by</span>
            { this.props.metastyles.map(metastyle => (
              <a key={metastyle}
                 className={`style-border ${metastyle}`} 
                 onClick={() => this.setFilter({metastyle})}>{metastyle}</a>
            )) }
            { this.state.metastyle && 
              <a onClick={() => this.setFilter({metastyle: null})}>✘ Reset</a> }
          </div>
          <BeerList beersGroupedByBrewery={breweries} app={app} />
        </div>
      </div>
    );
  }
}

FilterableSortableBeerList.propTypes = {
  session: PropTypes.string,
  metastyles: PropTypes.arrayOf(PropTypes.string).isRequired,
  beers: PropTypes.object.isRequired,
  app: PropTypes.object.isRequired
};