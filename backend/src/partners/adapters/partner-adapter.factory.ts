import { Injectable } from '@nestjs/common';
import { MockPartnerAdapter } from './mock-partner.adapter';
import { PartnerStoreAdapter } from './partner-adapter.interface';
import { PizzaHutPartnerAdapter } from './pizza-hut.adapter';

@Injectable()
export class PartnerAdapterFactory {
  private readonly adapters: Map<string, PartnerStoreAdapter>;

  constructor(
    private readonly mockAdapter: MockPartnerAdapter,
    private readonly pizzaHutAdapter: PizzaHutPartnerAdapter,
  ) {
    this.adapters = new Map<string, PartnerStoreAdapter>([
      [this.mockAdapter.adapterType, this.mockAdapter],
      [this.pizzaHutAdapter.adapterType, this.pizzaHutAdapter],
    ]);
  }

  getAdapter(adapterType: string): PartnerStoreAdapter {
    const adapter = this.adapters.get(adapterType.toUpperCase());
    return adapter ?? this.mockAdapter;
  }
}
