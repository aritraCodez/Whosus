import { Component, type ReactNode } from "react";
export class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="webgl-error">
        <h2>The station needs WebGL.</h2>
        <p>Enable hardware acceleration and reload your browser.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
