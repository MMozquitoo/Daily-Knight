import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { TodayScreen } from '../screens/TodayScreen';
import { today20260818 } from '../fixtures/today-2026-08-18';
import type { TodayEvents } from '../events';

function mockEvents(): TodayEvents {
  return {
    viewed: jest.fn(),
    accepted: jest.fn(),
    rejected: jest.fn(),
    swapped: jest.fn(),
    worn: jest.fn(),
    imageFallbackUsed: jest.fn(),
  };
}

describe('TodayScreen — flujo completo, fixture real 18 ago 2026', () => {
  test('estado ready: muestra el outfit, el bloque Pourquoi unificado, y dispara viewed', () => {
    const events = mockEvents();
    render(<TodayScreen outfit={today20260818} status="ready" events={events} userName="Adrien" />);

    expect(screen.getByTestId('today-screen')).toBeTruthy();
    expect(screen.getByTestId('garment-card-CM-04')).toBeTruthy();
    expect(screen.getByTestId('garment-card-PA-17')).toBeTruthy();
    expect(screen.getByTestId('garment-card-SN-05')).toBeTruthy();

    // Pourquoi: explicación + clima + agenda en un solo bloque, no partidos.
    const why = screen.getByTestId('why-block');
    expect(why).toBeTruthy();
    expect(screen.getByText(today20260818.why)).toBeTruthy();
    expect(screen.getByText(/19–27°C · cloudy · pluie 3%/)).toBeTruthy();
    expect(screen.getByText(/2 événements · journée casual/)).toBeTruthy();

    expect(events.viewed).toHaveBeenCalledWith('2026-08-18');
  });

  test('carry vacío: el bloque no se renderiza, no queda un hueco', () => {
    const events = mockEvents();
    render(<TodayScreen outfit={today20260818} status="ready" events={events} userName="Adrien" />);
    expect(screen.queryByTestId('carry-block')).toBeNull();
  });

  test('acciones visibles: Je la porte, Changer une pièce y Autre tenue — ninguna escondida', () => {
    const events = mockEvents();
    render(<TodayScreen outfit={today20260818} status="ready" events={events} userName="Adrien" />);
    expect(screen.getByTestId('action-accept')).toBeTruthy();
    expect(screen.getByTestId('action-swap')).toBeTruthy();
    expect(screen.getByTestId('action-regenerate')).toBeTruthy();
  });

  test('fallback invisible: CM-04/PA-17 sin clean reportan telemetría pero NO exponen tier en la UI', () => {
    const events = mockEvents();
    render(<TodayScreen outfit={today20260818} status="ready" events={events} userName="Adrien" />);

    // CM-04 y PA-17 no tienen asset "clean" en el fixture real -> caen a product.
    expect(events.imageFallbackUsed).toHaveBeenCalledWith('CM-04', 'product');
    expect(events.imageFallbackUsed).toHaveBeenCalledWith('PA-17', 'product');
    // SN-05 sí tiene "clean" -> nunca se reporta como fallback.
    expect(events.imageFallbackUsed).not.toHaveBeenCalledWith('SN-05', expect.anything());

    // Ningún vocabulario interno del pipeline debe filtrarse a la UI.
    expect(screen.queryByText(/product/i)).toBeNull();
    expect(screen.queryByText(/clean/i)).toBeNull();
    expect(screen.queryByText(/tier/i)).toBeNull();
  });

  test('aceptar: dispara accepted y muestra la confirmación', () => {
    const events = mockEvents();
    render(<TodayScreen outfit={today20260818} status="ready" events={events} userName="Adrien" />);

    fireEvent.press(screen.getByTestId('action-accept'));

    expect(events.accepted).toHaveBeenCalledWith('2026-08-18');
    expect(screen.getByTestId('today-actions-accepted')).toBeTruthy();
    expect(screen.queryByTestId('action-accept')).toBeNull();
  });

  test('cambiar una pieza: dispara swapped(layer)', () => {
    const events = mockEvents();
    render(<TodayScreen outfit={today20260818} status="ready" events={events} userName="Adrien" />);
    fireEvent.press(screen.getByTestId('action-swap'));
    expect(events.swapped).toHaveBeenCalledWith('2026-08-18', 'top');
  });

  test('regenerar: dispara rejected y llama onRegenerate', () => {
    const events = mockEvents();
    const onRegenerate = jest.fn();
    render(<TodayScreen outfit={today20260818} status="ready" events={events} userName="Adrien" onRegenerate={onRegenerate} />);
    fireEvent.press(screen.getByTestId('action-regenerate'));
    expect(events.rejected).toHaveBeenCalledWith('2026-08-18');
    expect(onRegenerate).toHaveBeenCalled();
  });

  test('estado loading: muestra el indicador, no el outfit', () => {
    const events = mockEvents();
    render(<TodayScreen outfit={null} status="loading" events={events} userName="Adrien" />);
    expect(screen.getByTestId('today-loading')).toBeTruthy();
    expect(screen.queryByTestId('today-screen')).toBeNull();
  });

  test('estado error: sin fila de Planificación, ofrece regenerar en vivo', () => {
    const events = mockEvents();
    const onRegenerate = jest.fn();
    render(<TodayScreen outfit={null} status="error" events={events} userName="Adrien" onRegenerate={onRegenerate} />);
    expect(screen.getByTestId('today-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('action-retry'));
    expect(onRegenerate).toHaveBeenCalled();
  });
});
