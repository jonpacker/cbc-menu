import {Component} from 'react'
import PropTypes from 'prop-types'
import State from '../../local_persistence'
export default class DatabaseProvider {
  getChildContext() {
    return { db: this.props.db }
  }
  render() {
    return <div>{this.props.children}</div>;
  }
}
DatabaseProvider.propTypes = {
  db: PropTypes.instanceOf(State).isRequired
}

DatabaseProvider.childContextTypes = {
  db: PropTypes.instanceOf(State)
}
