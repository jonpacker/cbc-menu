import React from 'react'
import PropTypes from 'prop-types'
import Beer from './beer'
export default class BeerList extends React.Component {
  render() {
    const breweries = this.props.beersGroupedByBrewery;
    return breweries.map(brewery => (
      <div key={brewery.name} className="brewery">
        <h2 key>{brewery.name}
          {brewery.location && <div className="location">{brewery.location}</div>}
        </h2>
        <div className="beers">
          {brewery.beers.map(beer => (
            <Beer app={this.props.app} key={beer.id} beer={beer} />
          ))}
        </div>
      </div>
    ));
  }
}

BeerList.propTypes = {
  beersGroupedByBrewery: PropTypes.arrayOf(PropTypes.object).isRequired,
  app: PropTypes.object.isRequired,
}