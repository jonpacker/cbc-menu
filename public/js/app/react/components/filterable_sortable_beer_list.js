import React from 'react'
import PropTypes from 'prop-types'
import BeerList from './beer_list'
import calcBeerList from '../../calc_beer_list'
import {debounce} from 'underscore'
const {Component} = React

export default class FilterableSortableBeerList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mini: props.app.db.mini,
      order: null,
      saved: null,
      tasted: null,
      today: null,
      metastyle: null,
      session: props.session,
      searchIndexReady: !!props.beers.fullTextSearchReady
    };
    this.fullTextIndexNotReady = this.fullTextIndexNotReady.bind(this);
    if (!props.beers.fullTextSearchReady) this.fullTextIndexNotReady();
    props.beers.on('fullTextIndexNotReady', this.fullTextIndexNotReady);

    this.searchInput = React.createRef();
    this.executeSearch = debounce(this.executeSearch.bind(this), 300)
    this.recalculateBeerList();

    this.sourceDataDidUpdate = this.sourceDataDidUpdate.bind(this);
    props.app.on('dataUpdate', this.sourceDataDidUpdate);
  }
  fullTextIndexNotReady() {
    console.log('got not ready');
    this.fullTextReadyListener = () => this.setState({searchIndexReady: true});
    this.props.beers.once('fullTextIndexReady', this.fullTextReadyListener);
    if (this.state.searchIndexReady) this.setState({searchIndexReady: false});
  }
  componentWillUnmount() {
    if (this.fullTextReadyListener)
      this.props.beers.removeListener('fullTextIndexReady', this.fullTextReadyListener);
    this.props.app.removeListener('dataUpdate', this.sourceDataDidUpdate);
  }
  sourceDataDidUpdate() {
    this.recalculateBeerList();
    this.forceUpdate();
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
    if (this.state.tasted != null) classes.push(this.state.tasted ? 'tasted' : 'not-tasted');
    if (this.state.saved != null) classes.push(this.state.saved ? 'saved' : 'not-saved');
    if (this.state.today != null) classes.push('today');
    if (this.state.isSearching) classes.push('searching');
    return classes;
  }
  changeSearchTerm(e) {
    // executeSearch is debounced, and react doesn't like keeping the `e` around.
    this.executeSearch(e.target.value);
  }
  async executeSearch(query) {
    if (!query) return this.setState({idMask: null, breweryCount: null, beerCount: null});
    const beers = await this.props.beers.search(query);
    let beerCount = 0;
    let breweryCount = 0;
    let breweries = {};
    const idMask = beers.reduce((mask, beer) => {
      beerCount++;
      if (!breweries[beer.brewery]) breweryCount++;
      breweries[beer.brewery] = true;
      mask[beer.id] = true;
      return mask;
    }, {});
    this.setState({idMask, breweryCount, beerCount});
  }
  toggleSearching() {
    const searching = !this.state.isSearching;
    if (!searching) {
      this.setState({
        beerCount: null,
        breweryCount: null,
        idMask: null,
        isSearching: searching
      });
    } else {
      this.setState({
        isSearching: searching
      });
    }
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevState.isSearching && this.state.isSearching == true) {
      this.searchInput.current.focus();
    }
  }
  render() {
    const classes = this.getClassList();
    let {breweries, beer_count} = this;
    let breweryCount = this.state.breweryCount == null ? breweries.length : this.state.breweryCount;
    let beerCount = this.state.beerCount == null ? beer_count : this.state.beerCount;
    const {app} = this.props;
    return (
      <div id="beerlist" className={classes.join(' ')}>
        <div className={`topBar ${this.state.isSearching ? 'searching' : ''}`}>
          { this.state.isSearching
            ? (<input className="searchQuery" onChange={e => this.changeSearchTerm(e)} ref={this.searchInput} />)
            : (<h1>{this.props.session ? `${this.props.session} session` : `all beers`}</h1> )}
          <sub>{beerCount} beers, {breweryCount} brewers</sub>
          <a className="back" href="#index"></a>
          <a className={`search ${this.state.searchIndexReady ? 'ready' : ''}`}
             onClick={() => this.toggleSearching()}></a>
        </div>
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
            {  <a className="ordering order-location" onClick={() => this.setOrder('location')}>Location</a> }
            <a className={`ordering ${this.state.order == null ? "order-by-name selected" : ""}`}
              onClick={() => this.setOrder(null)}>Brewery</a>
          </div>
          <div className="filter bar">
            <span className="info">Filter by</span>
            <a className="tasted" onClick={() => this.setFilter({tasted: true})}>✓</a>
            <a className="not-tasted" onClick={() => this.setFilter({tasted: false})}>NOT ✓</a>
            <a className="saved" onClick={() => this.setFilter({saved: true})}>★</a>
            <a className="not-saved" onClick={() => this.setFilter({saved: false})}>NOT ★</a>
            { app.config.allowFilterByToday && (
              <a className="today" onClick={() => this.setFilter({today: true})}>Only Today</a> )}
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
          <BeerList beersGroupedByBrewery={breweries} idMask={this.state.idMask} app={app} />
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
