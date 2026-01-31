import { ZodSchema } from 'zod';
import chalk from 'chalk';

export class ValidationUtils {
    /**
     * Validate data against a schema and log errors if any.
     * Returns the parsed data if successful, or null if failed.
     */
    static validate<T>(schema: ZodSchema<T>, data: any, label: string = 'Data'): T | null {
        const result = schema.safeParse(data);

        if (!result.success) {
            console.error(chalk.red(`❌ ${label} validation failed:`));
            const formatted = result.error.format();

            // Recursive helper to print error messages
            const printErrors = (obj: any, prefix: string = '') => {
                for (const key in obj) {
                    if (key === '_errors') {
                        if (obj._errors.length > 0) {
                            console.error(chalk.yellow(`   ${prefix}: ${obj._errors.join(', ')}`));
                        }
                    } else {
                        printErrors(obj[key], prefix ? `${prefix}.${key}` : key);
                    }
                }
            };

            printErrors(formatted);
            return null;
        }

        return result.data;
    }
}
