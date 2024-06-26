export enum OrderStatusEnum {
    ORDER_ACCEPTED = 'ACCEPTED', //(Order Created Successfully.)
    ORDER_ALLOTTED = 'ALLOTTED', //(Rider Alloted to pick up the items.)
    ARRIVED = "ARRIVED", //(Rider has reached the pickup location.)
    DISPATCHED = "DISPATCHED", //(Order is picked up by the rider.)
    ARRIVED_CUSTOMER_DOORSTEP = "ARRIVED_CUSTOMER_DOORSTEP", //(Rider has reached the drop-off location.)
    DELIVERED = "DELIVERED", // (Successfully delivered and transaction has concluded.)
    ORDER_CANCELLED = "CANCELLED", // (Order is cancelled.)
    RECEIVER_NOT_AVAILABLE = "RECEIVER_NOT_AVAILABLE", //(Receiver is not available.)
    RETURNED_TO_SELLER = "RETURNED_TO_SELLER" //(Order was returned to Restaurant.)
}