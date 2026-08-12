import React from 'react';

// Live date/time for the header - standard AMI platform requirement.
class Clock extends React.Component {
  constructor(props) {
    super(props);
    this.state = { now: new Date() };
  }
  componentDidMount() { this.timer = setInterval(() => this.setState({ now: new Date() }), 1000); }
  componentWillUnmount() { clearInterval(this.timer); }
  render() {
    const { now } = this.state;
    return (
      <div className="header-clock" title="Server-synchronised local time">
        <div className="clock-time">{now.toLocaleTimeString()}</div>
        <div className="clock-date">
          {now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      </div>
    );
  }
}
export default Clock;
