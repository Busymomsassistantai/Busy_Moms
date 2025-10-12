import { MeasurementConverter, MeasurementType } from './measurementConverter'

export interface InstacartCompatibleMeasurement {
  quantity: number
  unit: string
  isCompatible: boolean
  originalQuantity?: number
  originalUnit?: string
}

export class InstacartUnitMapper {
  private static readonly INSTACART_PREFERRED_UNITS: Record<string, Record<string, string>> = {
    dairy: {
      volume: 'fluid ounce',
      weight: 'ounce',
      count: 'item',
    },
    produce: {
      volume: 'cup',
      weight: 'pound',
      count: 'each',
    },
    meat: {
      volume: 'cup',
      weight: 'pound',
      count: 'item',
    },
    bakery: {
      volume: 'cup',
      weight: 'ounce',
      count: 'item',
    },
    baby: {
      volume: 'fluid ounce',
      weight: 'ounce',
      count: 'item',
    },
    beverages: {
      volume: 'fluid ounce',
      weight: 'ounce',
      count: 'item',
    },
    frozen: {
      volume: 'cup',
      weight: 'ounce',
      count: 'item',
    },
    household: {
      volume: 'fluid ounce',
      weight: 'ounce',
      count: 'item',
    },
    snacks: {
      volume: 'cup',
      weight: 'ounce',
      count: 'item',
    },
    health: {
      volume: 'fluid ounce',
      weight: 'ounce',
      count: 'item',
    },
    pantry: {
      volume: 'cup',
      weight: 'ounce',
      count: 'item',
    },
    other: {
      volume: 'cup',
      weight: 'ounce',
      count: 'item',
    },
  }

  private static readonly INSTACART_SUPPORTED_UNITS = [
    'cup',
    'tablespoon',
    'teaspoon',
    'fluid ounce',
    'gallon',
    'milliliter',
    'liter',
    'pint',
    'quart',
    'gram',
    'kilogram',
    'pound',
    'ounce',
    'each',
    'bunch',
    'can',
    'package',
    'item',
  ]

  static mapToInstacartUnit(
    quantity: number,
    unit: string,
    category?: string
  ): InstacartCompatibleMeasurement {
    const normalizedUnit = MeasurementConverter.normalizeUnit(unit)

    if (this.isInstacartCompatible(normalizedUnit)) {
      return {
        quantity,
        unit: normalizedUnit,
        isCompatible: true,
      }
    }

    const measurementType = MeasurementConverter.getMeasurementType(normalizedUnit)
    const targetUnit = this.getPreferredUnitForCategory(category || 'other', measurementType)

    try {
      const converted = MeasurementConverter.convert(quantity, normalizedUnit, targetUnit)
      return {
        quantity: converted.quantity,
        unit: converted.unit,
        isCompatible: true,
        originalQuantity: quantity,
        originalUnit: normalizedUnit,
      }
    } catch (error) {
      return {
        quantity,
        unit: 'item',
        isCompatible: false,
        originalQuantity: quantity,
        originalUnit: normalizedUnit,
      }
    }
  }

  static isInstacartCompatible(unit: string): boolean {
    const normalized = MeasurementConverter.normalizeUnit(unit)
    return this.INSTACART_SUPPORTED_UNITS.includes(normalized)
  }

  static getPreferredUnitForCategory(category: string, measurementType: MeasurementType): string {
    const categoryPrefs = this.INSTACART_PREFERRED_UNITS[category] || this.INSTACART_PREFERRED_UNITS.other
    return categoryPrefs[measurementType] || 'item'
  }

  static formatForInstacart(
    quantity: number | null | undefined,
    unit: string | null | undefined,
    category?: string
  ): { quantity: number; unit: string } {
    if (!quantity || quantity <= 0) {
      return { quantity: 1, unit: 'item' }
    }

    if (!unit) {
      const measurementType = 'count'
      const defaultUnit = this.getPreferredUnitForCategory(category || 'other', measurementType)
      return { quantity, unit: defaultUnit }
    }

    const mapped = this.mapToInstacartUnit(quantity, unit, category)
    return { quantity: mapped.quantity, unit: mapped.unit }
  }

  static suggestUnitForIngredient(ingredientName: string, category?: string): string {
    const name = ingredientName.toLowerCase()

    if (category === 'produce' || this.isProduceItem(name)) {
      return 'each'
    }

    if (category === 'meat' || this.isMeatItem(name)) {
      return 'pound'
    }

    if (category === 'dairy' || this.isDairyItem(name)) {
      return this.isDairyLiquid(name) ? 'fluid ounce' : 'ounce'
    }

    if (category === 'beverages' || this.isBeverageItem(name)) {
      return 'fluid ounce'
    }

    if (this.isPantryDry(name)) {
      return 'cup'
    }

    if (this.isPantrySpice(name)) {
      return 'teaspoon'
    }

    return 'item'
  }

  private static isProduceItem(name: string): boolean {
    const produceKeywords = [
      'tomato', 'onion', 'potato', 'carrot', 'apple', 'orange', 'banana',
      'lettuce', 'cucumber', 'pepper', 'avocado', 'lemon', 'lime',
      'celery', 'broccoli', 'cauliflower', 'spinach', 'kale',
    ]
    return produceKeywords.some(keyword => name.includes(keyword))
  }

  private static isMeatItem(name: string): boolean {
    const meatKeywords = [
      'chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'salmon',
      'steak', 'ground', 'bacon', 'sausage', 'ham',
    ]
    return meatKeywords.some(keyword => name.includes(keyword))
  }

  private static isDairyItem(name: string): boolean {
    const dairyKeywords = [
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'sour cream',
      'cottage cheese', 'ricotta', 'mozzarella', 'cheddar',
    ]
    return dairyKeywords.some(keyword => name.includes(keyword))
  }

  private static isDairyLiquid(name: string): boolean {
    const liquidKeywords = ['milk', 'cream', 'half and half', 'buttermilk']
    return liquidKeywords.some(keyword => name.includes(keyword))
  }

  private static isBeverageItem(name: string): boolean {
    const beverageKeywords = [
      'juice', 'soda', 'water', 'coffee', 'tea', 'wine', 'beer',
      'drink', 'beverage',
    ]
    return beverageKeywords.some(keyword => name.includes(keyword))
  }

  private static isPantryDry(name: string): boolean {
    const dryKeywords = [
      'flour', 'sugar', 'rice', 'pasta', 'oats', 'cereal', 'breadcrumb',
      'cornmeal', 'quinoa', 'couscous',
    ]
    return dryKeywords.some(keyword => name.includes(keyword))
  }

  private static isPantrySpice(name: string): boolean {
    const spiceKeywords = [
      'salt', 'pepper', 'cinnamon', 'cumin', 'paprika', 'oregano',
      'basil', 'thyme', 'rosemary', 'garlic powder', 'onion powder',
      'chili powder', 'turmeric', 'ginger', 'nutmeg', 'cloves',
    ]
    return spiceKeywords.some(keyword => name.includes(keyword))
  }

  static validateInstacartMeasurement(quantity: number, unit: string): {
    isValid: boolean
    warnings: string[]
  } {
    const warnings: string[] = []

    if (!this.isInstacartCompatible(unit)) {
      warnings.push(`Unit "${unit}" may not be supported by Instacart API`)
    }

    if (quantity <= 0) {
      warnings.push('Quantity must be greater than 0')
    }

    if (quantity > 1000) {
      warnings.push('Unusually large quantity detected')
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    }
  }

  static getInstacartCompatibleUnits(): string[] {
    return [...this.INSTACART_SUPPORTED_UNITS]
  }

  static getCategoryPreferredUnits(category: string): { volume: string; weight: string; count: string } {
    return this.INSTACART_PREFERRED_UNITS[category] || this.INSTACART_PREFERRED_UNITS.other
  }
}
