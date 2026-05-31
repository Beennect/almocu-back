import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'cnpj', async: false })
export class CnpjValidator implements ValidatorConstraintInterface {
  validate(cnpj: string): boolean {
    const cleaned = cnpj.replace(/[^\d]/g, '');

    if (cleaned.length !== 14) return false;

    // Reject known invalid sequences
    if (/^(\d)\1{13}$/.test(cleaned)) return false;

    // Validate check digits
    const calc = (digits: number[]) => {
      const multipliers =
        digits.length === 12
          ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
          : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

      const sum = digits.reduce((acc, d, i) => acc + d * multipliers[i], 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const digits = cleaned.split('').map(Number);
    const firstCheck = calc(digits.slice(0, 12));
    if (firstCheck !== digits[12]) return false;

    const secondCheck = calc(digits.slice(0, 13));
    if (secondCheck !== digits[13]) return false;

    return true;
  }

  defaultMessage(): string {
    return 'CNPJ inválido';
  }
}
