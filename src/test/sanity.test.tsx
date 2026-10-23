import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Testing environment', () => {
  it('renders a component and uses jest-dom matchers', () => {
    render(<div data-testid="test-div">Testing setup is operational</div>)
    expect(screen.getByTestId('test-div')).toBeInTheDocument()
    expect(screen.getByTestId('test-div')).toHaveTextContent(
      'Testing setup is operational',
    )
  })
})
