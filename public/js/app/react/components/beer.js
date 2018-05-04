import React from 'react'
import PropTypes from 'prop-types'
import {RatingSlider, StaticRatingSlider} from './rating_slider'
export default class Beer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      saved: props.beer.saved == 'saved' || props.beer.saved === true,
      tasted: props.beer.tasted == 'tasted' || props.beer.tasted === true,
      rating: props.beer.rating,
      notes: props.beer.notes,
      liveRating: props.beer.live_rating,
      liveRatingCount: props.beer.live_rating_count,
      isSentToUntappd: props.beer.ut_checked_in,
      expanded: false
    };
    this.liveRatingDidChange = this.liveRatingDidChange.bind(this);
  }
  componentDidMount() {
    this.props.app.on(`update-live-rating-${this.props.beer.id}`, this.liveRatingDidChange);
  }
  componentWillUnmount() {
    this.props.app.removeListener(`update-live-rating-${this.props.beer.id}`, this.liveRatingDidChange);
  }
  toggleExpand(e) {
    if (e.target.matches('.star, .tick, textarea, input, a, .rating-slider-control, .rating-slider-control *')) {
      return;
    }
    this.setState({expanded: !this.state.expanded});
  }
  getClassList() {
    const {beer} = this.props;
    const classes = [
      'beer',
      'style-border',
      this.props.hidden ? 'hidden' : '',
      this.state.saved ? 'saved' : '',
      this.state.tasted ? 'tasted' : '',
      this.state.isRating ? 'add-rating' : '',
      this.state.notes ? "has-notes" : "",
      this.state.isSentToUntappd ? "ut-checked-in" : "",
      this.state.expanded ? 'expand' : '',
      beer.tag,
      beer.session,
      beer.sessionSet,
      beer.metastyle,
      beer.no_available_info ? "no-info" : "",
      beer.ut_h_ch ? "ut-historic-checked-in" : ""
    ];
    if (beer.rating) classes.push('has-rating', `r-${beer.rating}`);
    return classes;
  }
  liveRatingDidChange(liveRating, liveRatingCount) {
    this.setState({liveRating, liveRatingCount});
  }
  toggleSaved() {
    const {app, beer} = this.props;
    app.toggleBeerSaved(beer.id, !this.state.saved);
    this.setState({saved: !this.state.saved});
  }
  toggleTasted() {
    const {app, beer} = this.props;
    app.toggleBeerTasted(beer.id, !this.state.tasted);
    this.setState({tasted: !this.state.tasted});
  }
  setRating(rating) {
    const {app, beer} = this.props;
    app.setBeerRating(beer.id, rating);
    app.toggleBeerTasted(beer.id, true);
    this.setState({tasted: true, rating});
  }
  setNotes(notes) {
    const {app, beer} = this.props;
    app.updateBeerData(beer.id, {notes});
    this.setState({notes});
  }
  async sendToUntappd() {
    const {app, beer} = this.props;
    try {
      clearTimeout(this.untappdErrorTimeout);
      this.setState({isSendingToUntappd: true, untappdError: ''});
      const res = await app.untappd.createCheckin(beer.ut_bid, this.state.rating, this.state.notes);
      this.setState({isSendingToUntappd: false, isSentToUntappd: true});
      app.updateBeerData(beer.id, {ut_checked_in:true});
    } catch (e) {
      this.setState({untappdError: `Error! 😰 Try again?! 🔂 (${e.message})`});
      this.untappdErrorTimeout = setTimeout(() => this.setState({untappdError: ''}));
    }
  }
  render() {
    const {beer, app} = this.props;
    return (
      <div className={this.getClassList().join(' ')} onClick={e => this.toggleExpand(e)}>
        <div className="headline">
          <div className="name-block">
            <div className="name">
              {beer.name}
              { beer.sessions.map((sess, i) => (
                <span key={`${beer.id}_${sess}_${i}`} className={`${sess}-indicator sess`}>{sess[0]}</span>
              ))}
            </div>
            <div className="abv">{ beer.percent ? beer.percent : '?' }</div>
            { (beer.ut_bid &&
              <div className="ut-avg">
                <img src="/img/ut_icon_144.png"/>
                { beer.ut_rating_clamped || '--' }
              </div>) || null }
            { !app.db.disableLiveRating && this.state.liveRating ?
                (<div className="live-avg">
                  <img src="/img/users.svg"/>
                  {this.state.liveRating.toFixed(2)}
                  </div>) : ''}
            <div className="style">{beer.mbcc_desc || beer.superstyle}</div>
          </div>
          <div className="marks">
            <a className="star" onClick={() => this.toggleSaved()}>★</a>
            <a className="tick" onClick={() => this.toggleTasted()}>✓</a>
          </div>
          <div className="ratings">
            <a className="site-bg-style score untappd"
              href={`https://untappd.com/beer/${beer.ut_bid}`} target="_blank">
              { beer.ut_rating ? `${beer.ut_rating_clamped}${beer.ut_rating_rank_br}` : 'no rating' }
            </a>
            { beer.ut_h_id ?
              (<a className="site-bg-style score untappd"
                href={`https://untappd.com/user/${app.db.untappdUser}/checkin/${beer.ut_h_id}`}
                target="_blank">
                You (UT): {beer.ut_h_ra}
              </a>)  : ''}
            { !app.db.disableLiveRating && this.state.liveRating &&
                <a className="site-bg-style score avg live-rating">
                    Users ({this.state.liveRatingCount}): {this.state.liveRating.toFixed(2)}
                </a> }
            <a className={`add-rating ${this.state.isRating ? 'is-rating' : ''}`}
               onClick={() => this.setState({isRating: !this.state.isRating})}>Rate</a>
          </div>
          <div className="expanded">
            <div className="desc">{beer.trunc_desc}</div>
          </div>
          <div className="rate-box">
            <label>Rating</label>
            { this.state.isRating
                ? <RatingSlider rating={this.state.rating} onRate={rating => this.setRating(rating)} />
                : <StaticRatingSlider rating={this.state.rating} onInteract={() => this.setState({isRating:true})} /> }

            <textarea name="rnotes" placeholder="Notes" className="notes" value={this.state.notes}
                      onChange={e => this.setNotes(e.target.value)}>
            </textarea>
            { app.db.untappdToken && beer.ut_bid &&
              <div className="untappd">
                { !this.state.isSentToUntappd &&
                  <a className="send-to-untappd" onClick={() => this.sendToUntappd()}>
                    <img src="/img/ut_icon_144.png" /> Send to Untappd
                  </a> }
                { this.state.isSendingToUntappd && <img src="/img/spin.svg" className="load" /> }
                { this.state.untappdError && <span className="untappd-error-text">{this.state.untappdError}</span> }
                { this.state.isSentToUntappd &&
                  <div className="sent-to-untappd">
                    <div className="beer-check-mark"/> you have sent this checkin to untappd
                  </div> }
              </div>
            }
          </div>
        </div>
      </div>
    );
  }
}

Beer.propTypes = {
  beer: PropTypes.object.isRequired,
  app: PropTypes.object.isRequired
}
