import { render, screen } from '@testing-library/react';
import App from './App';

test('renders welcome hero message', () => {
  render(<App />);
  expect(screen.getByText(/hey there/i)).toBeInTheDocument();
});

test('renders all four mode tabs', () => {
  render(<App />);
  expect(screen.getByRole('tab', { name: /q&a/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /campus guide/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /chat/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /tutor/i })).toBeInTheDocument();
});

test('renders the Tartan Scotty brand title', () => {
  render(<App />);
  expect(screen.getByText(/tartan scotty/i)).toBeInTheDocument();
});

test('renders without crashing when no messages exist', () => {
  expect(() => render(<App />)).not.toThrow();
});
