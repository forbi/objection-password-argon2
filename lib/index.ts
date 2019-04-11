import { Model, ModelOptions, QueryContext } from 'objection'
import Argon2 from 'argon2'

interface Options {
  allowEmptyPassword?: boolean;
  passwordField?: string;
}

const DEFAULT_OPTIONS: Options = {
  allowEmptyPassword: false,
  passwordField: 'password'
}

export default function objectionPasswordArgon2 (options: Options = DEFAULT_OPTIONS): Function {
  return (ModelClass: typeof Model) => {
    return class extends ModelClass {
      /**
       * Detect rehashing for avoiding undesired effects
       */
      public static isArgonHash (str: string): boolean {
        return isArgonHash(str)
      }

      /**
       * Compares a password to an Argon2 hash
       */
      public static async verifyPassword (password: string, otherPassword: string): Promise<boolean> {
        const hash = await Argon2.hash(password)
        return Argon2.verify(hash, otherPassword)
      }

      public async $beforeInsert (context: QueryContext) {
        await super.$beforeInsert(context)

        return this.generateHash()
      }

      public async $beforeUpdate (opt: ModelOptions, queryContext: QueryContext) {
        await super.$beforeUpdate(opt, queryContext)

        if (opt.patch && this.getPasswordHash() === undefined) {
          return
        }

        return this.generateHash()
      }

      /**
       * Compares a password to an Argon2 hash
       */
      public async verifyPassword (password: string): Promise<boolean> {
        const hash = this.getPasswordHash()

        if (!hash) {
          return false
        }

        return Argon2.verify(hash, password)
      }

      /**
       * Generates an Argon2 hash
       */
      private async generateHash () {
        const password = this.getPasswordHash()

        if (password && password.length > 0) {
          if (isArgonHash(password)) {
            throw new Error('Argon2 tried to hash another Argon2 hash')
          }

          const hash = await Argon2.hash(password)
          this.setPasswordHash(hash)
          return
        }

        if (!options.allowEmptyPassword) {
          throw new Error('password must not be empty')
        }
      }

      private setPasswordHash (hash: string) {
        // @ts-ignore
        this[options.passwordField] = hash
      }

      private getPasswordHash (): string | null | undefined {
        // @ts-ignore
        return this[options.passwordField]
      }
    }
  }
}

function isArgonHash (str: string) {
  const ARGON2_REGEXP = /^\$argon/
  return ARGON2_REGEXP.test(str)
}
