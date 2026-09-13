import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/ScottyAvatar', () => {
  return function MockScottyAvatar() {
    return <div data-testid="scotty-avatar" />;
  };
});

test('renders pre-login overview when not authenticated', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /hey, i'm scotty/i })).toBeInTheDocument();
  expect(screen.getByText('MyTartan')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
});

test('renders without crashing', () => {
  expect(() => render(<App />)).not.toThrow();
});

test('renders the face editor from ?facialAlign', () => {
  window.history.pushState({}, '', '/?facialAlign');
  render(<App />);
  expect(screen.getByRole('heading', { name: /scotty face editor/i })).toBeInTheDocument();
  window.history.pushState({}, '', '/');
});
