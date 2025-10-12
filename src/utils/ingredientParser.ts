import { MeasurementConverter } from './measurementConverter'

export interface ParsedIngredient {
  quantity: number | null
  unit: string | null
  ingredient: string
  originalText: string
  confidence: number
  isRange: boolean
  minQuantity?: number
  maxQuantity?: number
}

export class IngredientParser {
  private static readonly FRACTION_MAP: Record<string, number> = {
    '¼': 0.25,
    '½': 0.5,
    '¾': 0.75,
    '⅓': 0.333,
    '⅔': 0.667,
    '⅛': 0.125,
    '⅜': 0.375,
    '⅝': 0.625,
    '⅞': 0.875,
    '1/4': 0.25,
    '1/2': 0.5,
    '3/4': 0.75,
    '1/3': 0.333,
    '2/3': 0.667,
    '1/8': 0.125,
    '3/8': 0.375,
    '5/8': 0.625,
    '7/8': 0.875,
  }

  private static readonly UNIT_PATTERN = [
    'cup', 'cups', 'c\\.',
    'tablespoon', 'tablespoons', 'tbsp', 'tbs', 'T',
    'teaspoon', 'teaspoons', 'tsp', 't',
    'fluid ounce', 'fluid ounces', 'fl oz', 'fl\\.oz', 'floz',
    'gallon', 'gallons', 'gal',
    'milliliter', 'milliliters', 'ml',
    'liter', 'liters', 'l',
    'pint', 'pints', 'pt',
    'quart', 'quarts', 'qt',
    'gram', 'grams', 'g',
    'kilogram', 'kilograms', 'kg',
    'pound', 'pounds', 'lb', 'lbs',
    'ounce', 'ounces', 'oz',
    'milligram', 'milligrams', 'mg',
    'each', 'ea',
    'bunch', 'bunches',
    'can', 'cans',
    'package', 'packages', 'pkg',
    'item', 'items',
    'piece', 'pieces',
    'clove', 'cloves',
    'slice', 'slices',
  ].join('|')

  static parse(text: string): ParsedIngredient {
    const originalText = text.trim()
    let confidence = 1.0

    const quantityResult = this.extractQuantity(text)
    let remainingText = quantityResult.remaining

    const unitResult = this.extractUnit(remainingText)
    const ingredient = unitResult.remaining.trim()

    if (!quantityResult.quantity && !unitResult.unit) {
      confidence = 0.3
    } else if (!quantityResult.quantity || !unitResult.unit) {
      confidence = 0.6
    }

    return {
      quantity: quantityResult.quantity,
      unit: unitResult.unit,
      ingredient: ingredient || originalText,
      originalText,
      confidence,
      isRange: quantityResult.isRange,
      minQuantity: quantityResult.minQuantity,
      maxQuantity: quantityResult.maxQuantity,
    }
  }

  private static extractQuantity(text: string): {
    quantity: number | null
    remaining: string
    isRange: boolean
    minQuantity?: number
    maxQuantity?: number
  } {
    const fractionPattern = Object.keys(this.FRACTION_MAP).join('|')
    const rangePattern = new RegExp(
      `^\\s*(\\d+(?:\\.\\d+)?|${fractionPattern})\\s*(?:-|to|–|—)\\s*(\\d+(?:\\.\\d+)?|${fractionPattern})\\s*`,
      'i'
    )

    const rangeMatch = text.match(rangePattern)
    if (rangeMatch) {
      const min = this.parseNumericValue(rangeMatch[1])
      const max = this.parseNumericValue(rangeMatch[2])
      const average = (min + max) / 2

      return {
        quantity: average,
        remaining: text.slice(rangeMatch[0].length),
        isRange: true,
        minQuantity: min,
        maxQuantity: max,
      }
    }

    const mixedPattern = new RegExp(
      `^\\s*(\\d+)\\s+(\\d+/\\d+|${fractionPattern})\\s*`,
      'i'
    )
    const mixedMatch = text.match(mixedPattern)
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1])
      const fraction = this.parseFraction(mixedMatch[2])
      return {
        quantity: whole + fraction,
        remaining: text.slice(mixedMatch[0].length),
        isRange: false,
      }
    }

    const singlePattern = new RegExp(
      `^\\s*(\\d+(?:\\.\\d+)?|${fractionPattern})\\s*`,
      'i'
    )
    const singleMatch = text.match(singlePattern)
    if (singleMatch) {
      const quantity = this.parseNumericValue(singleMatch[1])
      return {
        quantity,
        remaining: text.slice(singleMatch[0].length),
        isRange: false,
      }
    }

    return {
      quantity: null,
      remaining: text,
      isRange: false,
    }
  }

  private static parseNumericValue(value: string): number {
    if (value in this.FRACTION_MAP) {
      return this.FRACTION_MAP[value]
    }

    const decimalMatch = value.match(/^\d+\.?\d*$/)
    if (decimalMatch) {
      return parseFloat(value)
    }

    return this.parseFraction(value)
  }

  private static parseFraction(fraction: string): number {
    if (fraction in this.FRACTION_MAP) {
      return this.FRACTION_MAP[fraction]
    }

    const match = fraction.match(/^(\d+)\/(\d+)$/)
    if (match) {
      const numerator = parseInt(match[1])
      const denominator = parseInt(match[2])
      return numerator / denominator
    }

    return 0
  }

  private static extractUnit(text: string): { unit: string | null; remaining: string } {
    const pattern = new RegExp(`^\\s*(${this.UNIT_PATTERN})\\b`, 'i')
    const match = text.match(pattern)

    if (match) {
      const unit = match[1].replace(/\./g, '').trim()
      return {
        unit: MeasurementConverter.normalizeUnit(unit),
        remaining: text.slice(match[0].length),
      }
    }

    return {
      unit: null,
      remaining: text,
    }
  }

  static formatIngredient(
    quantity: number | null,
    unit: string | null,
    ingredient: string
  ): string {
    const parts: string[] = []

    if (quantity !== null) {
      parts.push(MeasurementConverter.formatQuantity(quantity))
    }

    if (unit) {
      parts.push(unit)
    }

    parts.push(ingredient)

    return parts.join(' ')
  }

  static smartDetectUnit(ingredientName: string, category?: string): string {
    const name = ingredientName.toLowerCase()

    if (category === 'produce' || name.includes('tomato') || name.includes('onion') ||
        name.includes('potato') || name.includes('apple') || name.includes('orange') ||
        name.includes('banana') || name.includes('carrot')) {
      return 'each'
    }

    if (category === 'meat' || name.includes('chicken') || name.includes('beef') ||
        name.includes('pork') || name.includes('fish') || name.includes('turkey')) {
      return 'pound'
    }

    if (name.includes('flour') || name.includes('sugar') || name.includes('salt') ||
        name.includes('rice') || name.includes('oats')) {
      return 'cup'
    }

    if (name.includes('milk') || name.includes('water') || name.includes('juice') ||
        name.includes('broth') || name.includes('stock') || name.includes('cream')) {
      return 'cup'
    }

    if (name.includes('butter') || name.includes('cheese') || name.includes('yogurt')) {
      return 'ounce'
    }

    if (name.includes('garlic')) {
      return 'clove'
    }

    if (name.includes('bread') || name.includes('toast')) {
      return 'slice'
    }

    return 'item'
  }

  static guessQuantity(ingredientName: string): number {
    const name = ingredientName.toLowerCase()

    if (name.includes('clove')) {
      return 2
    }

    if (name.includes('bunch')) {
      return 1
    }

    if (name.includes('can')) {
      return 1
    }

    return 1
  }
}
