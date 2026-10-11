import React from 'react';

// A disco/state filter dropdown whose OPTIONS always come from the server
// (api.listDiscos()/api.listStates()), which are already scoped per account
// (scope.js on the backend) - a DisCo account's list only ever has its own
// DisCo, a single-state NERC office's list only ever has its one state.
//
// When that list has 2+ real entries, this renders a normal "All ..." +
// options dropdown, same as before RBAC. When it has exactly one entry,
// there's no real choice to offer, so this renders a plain locked label
// instead and auto-selects that one value - a 2-item dropdown ("All" /
// "AEDC") that both resolve to the same data just implies a choice that
// isn't there.
class ScopeFilter extends React.Component {
  componentDidMount() { this.lockIfSingleOption(); }
  componentDidUpdate() { this.lockIfSingleOption(); }

  lockIfSingleOption() {
    const { options, value, onChange, getValue } = this.props;
    if (options.length === 1) {
      const onlyValue = getValue(options[0]);
      if (value !== onlyValue) onChange(onlyValue);
    }
  }

  render() {
    const { label, value, options, onChange, allLabel, getValue, getLabel } = this.props;
    if (options.length === 0) {
      // Still loading, or genuinely nothing in scope - either way there is
      // nothing useful to render yet.
      return null;
    }
    if (options.length === 1) {
      return (
        <label>{label}
          <div className="locked-filter" title="Your account is scoped to this value only">
            {getLabel(options[0])}
          </div>
        </label>
      );
    }
    return (
      <label>{label}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="all">{allLabel}</option>
          {options.map((o) => (
            <option key={getValue(o)} value={getValue(o)}>{getLabel(o)}</option>
          ))}
        </select>
      </label>
    );
  }
}

export default ScopeFilter;
