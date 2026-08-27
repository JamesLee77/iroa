import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('IROA homepage shell', () => {
  it('exposes one main landmark and the approved hero promise', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: '말로 요청하면, 현실의 일이 안전하게 완료됩니다.',
      }),
    ).toBeInTheDocument();
  });
});
