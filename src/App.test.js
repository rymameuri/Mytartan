import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/ScottyAvatar', () => {
  return function MockScottyAvatar() {
    return <div data-testid="scotty-avatar" />;
  };
});

test('renders landing page call to action', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /start chatting with mytartan/i })).toBeInTheDocument();
});

test('renders without crashing when no messages exist', () => {
  expect(() => render(<App />)).not.toThrow();
});
