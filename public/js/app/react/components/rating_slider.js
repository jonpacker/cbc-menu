import React from 'react'
import PropTypes from 'prop-types'
import DragListener from '../../helpers/drag_listener'

export class StaticRatingSlider extends React.Component {
  constructor(props) {
    super(props);
  }

  interact() {
    this.props.onInteract && this.props.onInteract();
  }

  render() {
    return [
      <div key="slider" onClick={() => this.interact()} 
           className="rating-slider-control" 
           ref={el => this.sliderContainer = el}>
        <div className="track"/>
        <div className="handle" 
              style={{left: `${this.props.rating / 5 * 100}%`}}
              ref={elem => this.sliderHandle = elem}/>
      </div>,
      <div key="slider-text" className="rating-text" ref={el => this.ratingText = el}>
        {this.props.rating}
      </div>
    ];
  }
}

StaticRatingSlider.propTypes = {
  rating: PropTypes.number,
  onInteract: PropTypes.func
};

export class RatingSlider extends StaticRatingSlider {
  constructor(props) {
    delete props.onInteract;
    super(props);
  }

  moveTo(pct) {
    this.sliderHandle.style.left = `${Math.round(pct * 20) * 5}%`;
    this.ratingText.textContent = Math.round(pct * 20) / 4;
  }

  componentDidMount() {
    console.log('mount')
    const getSliderWidth = () => parseFloat(window.getComputedStyle(this.sliderContainer).width)
    this.dragListener = DragListener(this.sliderHandle, 0, getSliderWidth, {
      stopPropagation: true
    });
    this.dragListener.on('drag', pct => this.moveTo(pct))
    this.dragListener.on('dragFinish', pct => {
      this.moveTo(pct);
      const rating = Math.round(pct * 20) / 4;
      this.props.onRate && this.props.onRate(rating);
    })
  }
  componentWillUnmount() {
    this.dragListener.stopListening();
    delete this.dragListener;
  }


}

RatingSlider.propTypes = {
  rating: PropTypes.number,
  onRate: PropTypes.func
}
