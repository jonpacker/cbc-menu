import React from 'react'
import PropTypes from 'prop-types'
import BeerSet from '../../beer_set'
import DatabaseContext from './database_context'
import calcBeerList from '../../calc_beer_list'
const {Component} = React

export default class FilterableSortableBeerList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mini: false,
      order: null,
      saved: null,
      tasted: null,
      today: null,
      metastyle: null
    };
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
    const {breweries, beer_count} = calcBeerList(this.props.beers, this.state);
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
            <a className="mini" onClick={() => this.setState({mini: !this.state.mini})}>Small UI</a>
            <span className="info">Sort by</span>
            <a className="site-bg-style ut_rating" onClick={() => this.setState({order: 'ut_rating'})}> 
              <img src="/img/ut_icon_144.png"/> Rating
            </a>
            <DatabaseContext.Consumer>
              {({disableLiveRating}) => (disableLiveRating &&
                <a className="site-bg-style avg live-rating" 
                   onClick={() => this.setState({order: 'live_rating'})}>👥 Rating</a> 
              )}
            </DatabaseContext.Consumer>
            <a className="ordering order-location" onClick={() => this.setState({order:'location'})}>Location</a>
            <a className={`ordering ${this.state.order == null ? "order-by-name selected" : ""}`} 
              onClick={() => this.setState({order:null})}>Brewery</a>
          </div>
          <div className="filter bar">
            <span className="info">Filter by</span>
            <a className="tasted" onClick={() => this.setState({tasted: 'tasted'})}>✓</a>
            <a className="not-tasted" onClick={() => this.setState({tasted: 'not-tasted'})}>NOT ✓</a>
            <a className="saved" onClick={() => this.setState({saved: 'saved'})}>★</a>
            <a className="not-saved" onClick={() => this.setState({saved: 'not-saved'})}>NOT ★</a>
            <a className="today" onClick={() => this.setState({today: true})}>Only Today</a>
            <a onClick={() => this.setState({
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
                 onClick={() => this.setState({metastyle})}>{metastyle}</a>
            )) }
            { this.state.metastyle && 
              <a onClick={() => this.setState({metastyle: null})}>✘ Reset</a> }
          </div>
        </div>
      </div>
    );
  }
}

FilterableSortableBeerList.propTypes = {
  session: PropTypes.string,
  metastyles: PropTypes.arrayOf(PropTypes.string).isRequired,
  beers: PropTypes.instanceOf(BeerSet).isRequired
};