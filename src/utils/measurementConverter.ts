export type MeasurementSystem = 'metric' | 'imperial'

export type VolumeUnit =
  | 'cup' | 'cups' | 'c'
  | 'tablespoon' | 'tablespoons' | 'tbsp' | 'tbs'
  | 'teaspoon' | 'teaspoons' | 'tsp'
  | 'fluid ounce' | 'fluid ounces' | 'fl oz' | 'floz'
  | 'gallon' | 'gallons' | 'gal'
  | 'milliliter' | 'milliliters' | 'ml'
  | 'liter' | 'liters' | 'l'
  | 'pint' | 'pints' | 'pt'
  | 'quart' | 'quarts' | 'qt'

export type WeightUnit =
  | 'gram' | 'grams' | 'g'
  | 'kilogram' | 'kilograms' | 'kg'
  | 'pound' | 'pounds' | 'lb' | 'lbs'
  | 'ounce' | 'ounces' | 'oz'
  | 'milligram' | 'milligrams' | 'mg'

export type CountUnit =
  | 'each' | 'ea'
  | 'bunch' | 'bunches'
  | 'can' | 'cans'
  | 'package' | 'packages' | 'pkg'
  | 'item' | 'items'
  | 'piece' | 'pieces'
  | 'clove' | 'cloves'
  | 'slice' | 'slices'

export type Unit = VolumeUnit | WeightUnit | CountUnit

export type MeasurementType = 'volume' | 'weight' | 'count'

export interface ConversionResult {
  quantity: number
  unit: string
  originalQuantity: number
  originalUnit: string
  conversionApplied: boolean
  confidence: number
}

export class MeasurementConverter {
  private static readonly VOLUME_TO_ML: Record<string, number> = {
    'cup': 236.588,
    'cups': 236.588,
    'c': 236.588,
    'tablespoon': 14.787,
    'tablespoons': 14.787,
    'tbsp': 14.787,
    'tbs': 14.787,
    'teaspoon': 4.929,
    'teaspoons': 4.929,
    'tsp': 4.929,
    'fluid ounce': 29.574,
    'fluid ounces': 29.574,
    'fl oz': 29.574,
    'floz': 29.574,
    'gallon': 3785.41,
    'gallons': 3785.41,
    'gal': 3785.41,
    'milliliter': 1,
    'milliliters': 1,
    'ml': 1,
    'liter': 1000,
    'liters': 1000,
    'l': 1000,
    'pint': 473.176,
    'pints': 473.176,
    'pt': 473.176,
    'quart': 946.353,
    'quarts': 946.353,
    'qt': 946.353,
  }

  private static readonly WEIGHT_TO_GRAMS: Record<string, number> = {
    'gram': 1,
    'grams': 1,
    'g': 1,
    'kilogram': 1000,
    'kilograms': 1000,
    'kg': 1000,
    'pound': 453.592,
    'pounds': 453.592,
    'lb': 453.592,
    'lbs': 453.592,
    'ounce': 28.3495,
    'ounces': 28.3495,
    'oz': 28.3495,
    'milligram': 0.001,
    'milligrams': 0.001,
    'mg': 0.001,
  }

  private static readonly UNIT_ALIASES: Record<string, string> = {
    'c': 'cup',
    'cups': 'cup',
    'tbsp': 'tablespoon',
    'tbs': 'tablespoon',
    'tablespoons': 'tablespoon',
    'tsp': 'teaspoon',
    'teaspoons': 'teaspoon',
    'fl oz': 'fluid ounce',
    'floz': 'fluid ounce',
    'fluid ounces': 'fluid ounce',
    'gal': 'gallon',
    'gallons': 'gallon',
    'ml': 'milliliter',
    'milliliters': 'milliliter',
    'l': 'liter',
    'liters': 'liter',
    'pt': 'pint',
    'pints': 'pint',
    'qt': 'quart',
    'quarts': 'quart',
    'g': 'gram',
    'grams': 'gram',
    'kg': 'kilogram',
    'kilograms': 'kilogram',
    'lb': 'pound',
    'lbs': 'pound',
    'pounds': 'pound',
    'oz': 'ounce',
    'ounces': 'ounce',
    'mg': 'milligram',
    'milligrams': 'milligram',
    'ea': 'each',
    'bunches': 'bunch',
    'cans': 'can',
    'packages': 'package',
    'pkg': 'package',
    'items': 'item',
    'pieces': 'piece',
    'cloves': 'clove',
    'slices': 'slice',
  }

  static normalizeUnit(unit: string): string {
    const normalized = unit.toLowerCase().trim()
    return this.UNIT_ALIASES[normalized] || normalized
  }

  static getMeasurementType(unit: string): MeasurementType {
    const normalized = this.normalizeUnit(unit)

    if (normalized in this.VOLUME_TO_ML) {
      return 'volume'
    }

    if (normalized in this.WEIGHT_TO_GRAMS) {
      return 'weight'
    }

    return 'count'
  }

  static convertVolume(quantity: number, fromUnit: string, toUnit: string): number {
    const normalizedFrom = this.normalizeUnit(fromUnit)
    const normalizedTo = this.normalizeUnit(toUnit)

    if (normalizedFrom === normalizedTo) {
      return quantity
    }

    const fromFactor = this.VOLUME_TO_ML[normalizedFrom]
    const toFactor = this.VOLUME_TO_ML[normalizedTo]

    if (!fromFactor || !toFactor) {
      throw new Error(`Cannot convert volume from ${fromUnit} to ${toUnit}`)
    }

    const milliliters = quantity * fromFactor
    return milliliters / toFactor
  }

  static convertWeight(quantity: number, fromUnit: string, toUnit: string): number {
    const normalizedFrom = this.normalizeUnit(fromUnit)
    const normalizedTo = this.normalizeUnit(toUnit)

    if (normalizedFrom === normalizedTo) {
      return quantity
    }

    const fromFactor = this.WEIGHT_TO_GRAMS[normalizedFrom]
    const toFactor = this.WEIGHT_TO_GRAMS[normalizedTo]

    if (!fromFactor || !toFactor) {
      throw new Error(`Cannot convert weight from ${fromUnit} to ${toUnit}`)
    }

    const grams = quantity * fromFactor
    return grams / toFactor
  }

  static convert(quantity: number, fromUnit: string, toUnit: string): ConversionResult {
    const normalizedFrom = this.normalizeUnit(fromUnit)
    const normalizedTo = this.normalizeUnit(toUnit)

    if (normalizedFrom === normalizedTo) {
      return {
        quantity,
        unit: normalizedTo,
        originalQuantity: quantity,
        originalUnit: normalizedFrom,
        conversionApplied: false,
        confidence: 1.0,
      }
    }

    const fromType = this.getMeasurementType(normalizedFrom)
    const toType = this.getMeasurementType(normalizedTo)

    if (fromType !== toType) {
      return {
        quantity,
        unit: normalizedFrom,
        originalQuantity: quantity,
        originalUnit: normalizedFrom,
        conversionApplied: false,
        confidence: 0,
      }
    }

    let convertedQuantity: number
    try {
      if (fromType === 'volume') {
        convertedQuantity = this.convertVolume(quantity, normalizedFrom, normalizedTo)
      } else if (fromType === 'weight') {
        convertedQuantity = this.convertWeight(quantity, normalizedFrom, normalizedTo)
      } else {
        convertedQuantity = quantity
      }

      const rounded = Math.round(convertedQuantity * 100) / 100

      return {
        quantity: rounded,
        unit: normalizedTo,
        originalQuantity: quantity,
        originalUnit: normalizedFrom,
        conversionApplied: true,
        confidence: 1.0,
      }
    } catch (error) {
      return {
        quantity,
        unit: normalizedFrom,
        originalQuantity: quantity,
        originalUnit: normalizedFrom,
        conversionApplied: false,
        confidence: 0,
      }
    }
  }

  static getDefaultUnitForSystem(measurementType: MeasurementType, system: MeasurementSystem): string {
    if (measurementType === 'volume') {
      return system === 'metric' ? 'milliliter' : 'cup'
    }

    if (measurementType === 'weight') {
      return system === 'metric' ? 'gram' : 'pound'
    }

    return 'each'
  }

  static convertToSystem(quantity: number, unit: string, targetSystem: MeasurementSystem): ConversionResult {
    const measurementType = this.getMeasurementType(unit)
    const targetUnit = this.getDefaultUnitForSystem(measurementType, targetSystem)
    return this.convert(quantity, unit, targetUnit)
  }

  static isValidUnit(unit: string): boolean {
    const normalized = this.normalizeUnit(unit)
    return normalized in this.VOLUME_TO_ML ||
           normalized in this.WEIGHT_TO_GRAMS ||
           ['each', 'bunch', 'can', 'package', 'item', 'piece', 'clove', 'slice'].includes(normalized)
  }

  static getSupportedUnits(measurementType?: MeasurementType): string[] {
    if (!measurementType) {
      return [
        ...Object.keys(this.VOLUME_TO_ML),
        ...Object.keys(this.WEIGHT_TO_GRAMS),
        'each', 'bunch', 'can', 'package', 'item', 'piece', 'clove', 'slice'
      ].filter(unit => !unit.includes(' ') && unit.length > 1)
    }

    if (measurementType === 'volume') {
      return Object.keys(this.VOLUME_TO_ML).filter(unit => !unit.includes(' ') && unit.length > 1)
    }

    if (measurementType === 'weight') {
      return Object.keys(this.WEIGHT_TO_GRAMS).filter(unit => !unit.includes(' ') && unit.length > 1)
    }

    return ['each', 'bunch', 'can', 'package', 'item', 'piece', 'clove', 'slice']
  }

  static getCommonUnits(system: MeasurementSystem): { volume: string[], weight: string[], count: string[] } {
    if (system === 'metric') {
      return {
        volume: ['milliliter', 'liter', 'tablespoon', 'teaspoon'],
        weight: ['gram', 'kilogram', 'milligram'],
        count: ['each', 'bunch', 'can', 'package', 'item'],
      }
    }

    return {
      volume: ['cup', 'tablespoon', 'teaspoon', 'fluid ounce', 'gallon', 'pint', 'quart'],
      weight: ['pound', 'ounce'],
      count: ['each', 'bunch', 'can', 'package', 'item'],
    }
  }

  static formatQuantity(quantity: number): string {
    if (quantity % 1 === 0) {
      return quantity.toString()
    }

    const fraction = this.decimalToFraction(quantity)
    if (fraction) {
      return fraction
    }

    return quantity.toFixed(2).replace(/\.?0+$/, '')
  }

  private static decimalToFraction(decimal: number): string | null {
    const tolerance = 0.01
    const commonFractions = [
      { decimal: 0.125, fraction: '1/8' },
      { decimal: 0.25, fraction: '1/4' },
      { decimal: 0.333, fraction: '1/3' },
      { decimal: 0.5, fraction: '1/2' },
      { decimal: 0.667, fraction: '2/3' },
      { decimal: 0.75, fraction: '3/4' },
    ]

    const whole = Math.floor(decimal)
    const fractionalPart = decimal - whole

    for (const { decimal: frac, fraction } of commonFractions) {
      if (Math.abs(fractionalPart - frac) < tolerance) {
        return whole > 0 ? `${whole} ${fraction}` : fraction
      }
    }

    return null
  }
}
