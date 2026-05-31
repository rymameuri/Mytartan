import { render, screen } from '@testing-library/react';
import App from './App';

test('renders welcome hero', () => {
  render(<App />);
  expect(screen.getByText(/hey there! i'm scotty/i)).toBeInTheDocument();
});
