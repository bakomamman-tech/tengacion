const { randomUUID } = require("crypto");

const BookingConfirmationLock = require(
  "../../models/tengaAgent/BookingConfirmationLock"
);

const DEFAULT_LEASE_MS = 30000;
const DEFAULT_WAIT_MS = 5000;
const RETRY_DELAY_MS = 50;

const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const lockIdFor = ({
  organizationId,
  agentId,
}) => `${String(organizationId)}:${String(agentId)}`;

const acquireBookingConfirmationLock = async ({
  organizationId,
  agentId,
  leaseMs = DEFAULT_LEASE_MS,
  waitMs = DEFAULT_WAIT_MS,
}) => {
  if (!organizationId || !agentId) {
    throw new Error(
      "Appointment confirmation lock context is incomplete."
    );
  }

  const ownerToken = randomUUID();
  const lockId = lockIdFor({
    organizationId,
    agentId,
  });
  const deadline = Date.now() + waitMs;

  while (Date.now() <= deadline) {
    const now = new Date();
    const lockedUntil = new Date(
      now.getTime() + leaseMs
    );

    try {
      const lock =
        await BookingConfirmationLock.findOneAndUpdate(
          {
            _id: lockId,
            $or: [
              {
                lockedUntil: {
                  $lte: now,
                },
              },
              {
                lockedUntil: {
                  $exists: false,
                },
              },
              {
                ownerToken: "",
              },
            ],
          },
          {
            $set: {
              ownerToken,
              lockedUntil,
            },
            $setOnInsert: {
              organizationId,
              agentId,
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true,
          }
        );

      if (
        lock &&
        lock.ownerToken === ownerToken
      ) {
        return {
          lockId,
          ownerToken,
          lockedUntil,
        };
      }
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }

    if (Date.now() <= deadline) {
      await delay(RETRY_DELAY_MS);
    }
  }

  throw new Error(
    "Appointment confirmation is busy. Please retry."
  );
};

const releaseBookingConfirmationLock = async ({
  organizationId,
  agentId,
  ownerToken,
}) => {
  if (!organizationId || !agentId || !ownerToken) {
    return;
  }

  const lockId = lockIdFor({
    organizationId,
    agentId,
  });

  await BookingConfirmationLock.updateOne(
    {
      _id: lockId,
      ownerToken,
    },
    {
      $set: {
        ownerToken: "",
        lockedUntil: new Date(0),
      },
    }
  );
};

const withBookingConfirmationLock = async ({
  organizationId,
  agentId,
  leaseMs,
  waitMs,
  task,
}) => {
  if (typeof task !== "function") {
    throw new Error(
      "Appointment confirmation lock task is required."
    );
  }

  const lock =
    await acquireBookingConfirmationLock({
      organizationId,
      agentId,
      leaseMs,
      waitMs,
    });

  try {
    return await task();
  } finally {
    try {
      await releaseBookingConfirmationLock({
        organizationId,
        agentId,
        ownerToken: lock.ownerToken,
      });
    } catch (error) {
      console.warn(
        "TengaAgent booking confirmation lock release failed; lease expiry will recover it.",
        error?.message || error
      );
    }
  }
};

module.exports = {
  acquireBookingConfirmationLock,
  releaseBookingConfirmationLock,
  withBookingConfirmationLock,
};
