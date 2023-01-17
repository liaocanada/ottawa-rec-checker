import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as agw from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class DashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getAvailabilitiesFunction = new lambda.Function(this, "getAvailabilitiesByCentreFunction", {
      functionName: "getAvailabilitiesByCentre",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "getAvailabilitiesByCentre.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "..", "..", "src")),
      timeout: cdk.Duration.seconds(15),
    });
    const lambdaIntegration = new HttpLambdaIntegration('dashboard-integration', getAvailabilitiesFunction);

    const httpApiGateway = new agw.HttpApi(this, 'httpApiGateway', {
      apiName: "badminton-availabilities",
      corsPreflight: {
        allowOrigins: ["http://badminton.davidliao.ca", "https://badminton.davidliao.ca"],
        allowHeaders: ["*"],
        allowMethods: [
          agw.CorsHttpMethod.GET,
          agw.CorsHttpMethod.HEAD,
          agw.CorsHttpMethod.OPTIONS,
          agw.CorsHttpMethod.POST,
        ],
        maxAge: cdk.Duration.hours(1),
      },
    });
    httpApiGateway.addRoutes({
      path: '/',
      methods: [agw.HttpMethod.GET],
      integration: lambdaIntegration,
    });
  }
}
