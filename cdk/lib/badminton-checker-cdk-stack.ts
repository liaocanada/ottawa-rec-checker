import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ses from "aws-cdk-lib/aws-ses";
import { EventbridgeToLambda } from "@aws-solutions-constructs/aws-eventbridge-lambda";
import { htmlBodyTemplate, subjectTemplate } from "./email-template";

export class BadmintonCheckerCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ddb = new dynamodb.Table(this, "badmintonAvailabilities", {
      tableName: "badminton",
      partitionKey: {
        name: "centre",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "dateAndTime",
        type: dynamodb.AttributeType.STRING,
      },
      tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const emailTemplate = new ses.CfnTemplate(this, "emailTemplate", {
      template: {
        templateName: "badminton-availability-found",
        subjectPart: subjectTemplate,
        htmlPart: htmlBodyTemplate,
      }
    });

    const recipients = ["badminton@davidliao.ca", "cindyliao2000@gmail.com"];
    const checkerFunction = new lambda.Function(this, "checkerFunction", {
      functionName: "checkBadminton",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "..", "src")),
      timeout: cdk.Duration.seconds(15),
      environment: {
        tableName: ddb.tableName,
        emailTemplateName: (emailTemplate.template as ses.CfnTemplate.TemplateProperty).templateName!,
        recipients: recipients.join(","),
        weekendOnly: "true",
      }
    });

    checkerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ses:SendTemplatedEmail"],
      // TODO stackoverflow.com/questions/53212356
      resources: [
        "arn:aws:ses:us-east-1:095371326078:template/badminton-availability-found",
        ...recipients.map(recipient => `arn:aws:ses:us-east-1:095371326078:identity/${recipient}`),
      ],
    }));

    ddb.grantReadWriteData(checkerFunction);

    new EventbridgeToLambda(this, "checkBadmintonScheduler", {
      existingLambdaObj: checkerFunction,
      eventRuleProps: {
        schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      },
    });
  }
}
