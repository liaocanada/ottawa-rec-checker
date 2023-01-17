import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);


const getAvailabilitiesByCentre = async () => {
    const res = await ddbDocClient.send(new ScanCommand({
        TableName: process.env.tableName || "badminton",
    }));

    const availabilitiesByCentre = {
        Richcraft: [],
        Cardelrec: [],
        Hintonburg: [],
        Minto: [],
        Nepean: [],
    };
    res.Items.filter(availability => !!availability.available)
        .forEach(availability => {
            const { centre, dateAndTime } = availability;
            availabilitiesByCentre[centre].push(dateAndTime);
        });

    return availabilitiesByCentre;
};

const main = async () => {
    return await getAvailabilitiesByCentre();
};

// main();
export const handler = async event => {
    return await main();
};
