import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/ScottyAvatar', () => {
  return function MockScottyAvatar() {
    return <div data-testid="scotty-avatar" />;
  };
});

test('renders login form when not authenticated', () => {
  render(<App />);
  expect(screen.getByRole('tab', { name: /log in/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
});

test('renders without crashing', () => {
  expect(() => render(<App />)).not.toThrow();
});
