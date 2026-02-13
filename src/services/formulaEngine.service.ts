import { Parser } from "expr-eval";
import { roundTo } from "../utils/number";

type FormulaContext = Record<string, number>;

export class FormulaEngine {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      operators: {
        add: true,
        subtract: true,
        multiply: true,
        divide: true,
        power: false,
        factorial: false,
      },
    });
  }

  evaluate(expression: string, context: FormulaContext, precision = 2): number {
    if (!expression) {
      throw new Error("Formula expression is required");
    }
    const ast = this.parser.parse(expression);
    const result = ast.evaluate(context);
    if (typeof result !== "number" || Number.isNaN(result)) {
      throw new Error("Formula evaluation failed");
    }
    return roundTo(result, precision);
  }
}

export const formulaEngine = new FormulaEngine();
