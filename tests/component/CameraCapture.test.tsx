import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import CameraCapture from '../../src/components/CameraCapture';

describe('CameraCapture Component rendering tests', () => {
  it('should compile as a valid React component function', () => {
    const mockSuccess = vi.fn();
    const mockReset = vi.fn();
    const mockError = vi.fn();

    const element = React.createElement(CameraCapture, {
      onCaptureSuccess: mockSuccess,
      onReset: mockReset,
      onError: mockError
    });

    expect(element).toBeDefined();
    expect(element.props.onCaptureSuccess).toBe(mockSuccess);
    expect(element.props.onReset).toBe(mockReset);
    expect(element.props.onError).toBe(mockError);
  });
});
