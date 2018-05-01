import React from 'react'
import PropTypes from 'prop-types'
import Beer from './beer'
export default class BeerList extends React.Component {
  render() {
    const breweries = this.props.beersGroupedByBrewery;
    const idMask = this.props.idMask;
    return breweries.map(brewery => {
      const allHidden = brewery.beers.reduce((hidden, beer) => hidden && !!idMask && !idMask[beer.id], true);
      return (
      <div key={brewery.name} className={`brewery ${allHidden && 'hidden'}`}>
        <h2 key>{brewery.name}
          {brewery.location && <div className="location">{brewery.location}</div>}
        </h2>
        <div className="beers">
          {brewery.beers.map(beer => (
            <Beer app={this.props.app} key={beer.id} beer={beer} hidden={!!idMask && !idMask[beer.id]} />
          ))}
        </div>
      </div>
    )});
  }
}

BeerList.propTypes = {
  beersGroupedByBrewery: PropTypes.arrayOf(PropTypes.object).isRequired,
  idMask: PropTypes.object,
  app: PropTypes.object.isRequired,
}
