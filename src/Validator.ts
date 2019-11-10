import { Schema } from "rsuite";
import { CheckType } from "rsuite/es/Schema";
import { ObjectType } from "rsuite/es/Schema/ObjectType";
import { CheckResult } from "rsuite/es/Schema/Type";
import {
  MessageBag,
  ParsedTypeRule,
  RulesInput,
  SchemaTypeAdaptor
} from "./types";
import StringTypeAdaptor from "./adaptors/StringTypeAdaptor";
import ArrayTypeAdaptor from "./adaptors/ArrayTypeAdaptor";
import ObjectTypeAdaptor from "./adaptors/ObjectTypeAdaptor";
import RulesParser from "./RulesParser";
import NumberTypeAdaptor from "./adaptors/NumberTypeAdaptor";
import BooleanTypeAdaptor from "./adaptors/BooleanTypeAdaptor";
import DateTypeAdaptor from "./adaptors/DateTypeAdaptor";
import defaultMessageBag from "./messages";

type RSuiteSchemaModel = ReturnType<typeof Schema.Model>;

class Validator {
  /**
   * 记录是否已经创建 Validator 实例，用于在设置语言包时给出警告
   */
  protected static $booted: boolean = false;

  protected static $globalMessageBag = defaultMessageBag;

  static make(rules: RulesInput, messages?: MessageBag): Validator {
    return new Validator(rules, messages);
  }

  static SchemaModel(
    rules: RulesInput,
    messages?: MessageBag
  ): RSuiteSchemaModel {
    return this.make(rules, messages).getSchemaModel();
  }

  static check(
    data: any,
    rules: RulesInput,
    messages?: MessageBag
  ): CheckResult {
    return this.make(rules, messages).check(data);
  }

  static messages(messages: MessageBag): void {
    if (Validator.$booted) {
      console.warn(
        "Validator.messages() won't take effect in Validator instances created before it's called. You may want to call it in advance."
      );
    }
    if (messages) {
      this.$globalMessageBag = {
        ...this.$globalMessageBag,
        ...messages
      };
    }
  }

  protected $rawRules: RulesInput;

  protected $parsedRules!: {
    [field: string]: ParsedTypeRule;
  };

  protected $schemaModel!: RSuiteSchemaModel;

  protected $messageBag?: MessageBag;

  constructor(rules: RulesInput, messages?: MessageBag) {
    Validator.$booted = true;
    this.$rawRules = rules;
    this.$messageBag = messages;
    this.parseRules();
    this.makeSchemaModel();
  }

  check(data: any): CheckResult<string> {
    return this.getSchemaModel().check(data);
  }

  getRawRules(): RulesInput {
    return this.$rawRules;
  }

  getParsedRules(): { [field: string]: ParsedTypeRule } {
    return this.$parsedRules;
  }

  getMessageBag(): MessageBag {
    return {
      ...Validator.$globalMessageBag,
      ...this.$messageBag
    };
  }

  protected parseRules(): void {
    this.$parsedRules = RulesParser.parse(this.getRawRules());
  }

  protected makeSchemaModelSchema(): { [field: string]: CheckType } {
    return this.parsedTypeRuleMap(this.getParsedRules());
  }

  protected parsedTypeRuleMap(input: {
    [path: string]: ParsedTypeRule;
  }): { [field: string]: CheckType } {
    return Object.keys(input).reduce<{ [field: string]: CheckType }>(
      (acc, field) => {
        acc[field] = this.newAdaptorForRule(input[field]).getSchemaType();
        return acc;
      },
      {}
    );
  }

  protected newAdaptorForRule({
    path: fieldName,
    type,
    rules,
    of,
    shape
  }: ParsedTypeRule): SchemaTypeAdaptor<any> {
    let adaptor: SchemaTypeAdaptor<any>;

    switch (type) {
      case "number":
        adaptor = new NumberTypeAdaptor(fieldName, this);
        break;
      case "array":
        adaptor = new ArrayTypeAdaptor(fieldName, this);
        if (of) {
          (adaptor as ArrayTypeAdaptor).setItemAdaptor(
            this.newAdaptorForRule(of)
          );
        }
        break;
      case "object":
        adaptor = new ObjectTypeAdaptor(fieldName, this);
        if (shape) {
          (adaptor.getSchemaType() as ObjectType).shape(
            this.parsedTypeRuleMap(shape)
          );
        }
        break;
      case "boolean":
        adaptor = new BooleanTypeAdaptor(fieldName, this);
        break;
      case "date":
        adaptor = new DateTypeAdaptor(fieldName, this);
        break;
      case "string":
      default:
        adaptor = new StringTypeAdaptor(fieldName, this);
        break;
    }

    return adaptor.applyRules(rules);
  }

  protected makeSchemaModel(): void {
    this.$schemaModel = Schema.Model(this.makeSchemaModelSchema());
  }

  getSchemaModel(): RSuiteSchemaModel {
    return this.$schemaModel;
  }
}

export default Validator;